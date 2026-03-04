package auth

import (
	"context"
	"fmt"
	"sync"
	"time"

	authv1 "k8s.io/api/authentication/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/jamesagarside/eck-ui/pkg/k8s"
)

// UserInfo holds the identity information returned by token validation.
type UserInfo struct {
	Username string              `json:"username"`
	UID      string              `json:"uid"`
	Groups   []string            `json:"groups"`
	Extra    map[string][]string `json:"extra,omitempty"`
}

// Service provides authentication and session management functionality.
type Service struct {
	k8sClient     *k8s.Client
	sessionStore  *SessionStore
	tokenCache    *tokenCache
	sessionSecret string
}

// tokenCacheEntry holds a cached token validation result with an expiry time.
type tokenCacheEntry struct {
	user   *UserInfo
	expiry time.Time
}

// tokenCache provides TTL-based caching for validated bearer tokens.
type tokenCache struct {
	mu    sync.RWMutex
	store sync.Map
	ttl   time.Duration
}

// newTokenCache creates a new token cache with the specified TTL.
func newTokenCache(ttl time.Duration) *tokenCache {
	return &tokenCache{ttl: ttl}
}

// get retrieves a cached user info for the given token, returning nil if
// the entry is missing or expired.
func (tc *tokenCache) get(token string) *UserInfo {
	val, ok := tc.store.Load(token)
	if !ok {
		return nil
	}

	entry := val.(*tokenCacheEntry)
	if time.Now().After(entry.expiry) {
		tc.store.Delete(token)
		return nil
	}

	return entry.user
}

// set stores a validated user info for the given token with the configured TTL.
func (tc *tokenCache) set(token string, user *UserInfo) {
	tc.store.Store(token, &tokenCacheEntry{
		user:   user,
		expiry: time.Now().Add(tc.ttl),
	})
}

// NewService creates a new auth Service with the given Kubernetes client,
// session secret, and token cache TTL.
func NewService(k8sClient *k8s.Client, sessionSecret string, tokenCacheTTL time.Duration) *Service {
	return &Service{
		k8sClient:     k8sClient,
		sessionStore:  NewSessionStore(),
		tokenCache:    newTokenCache(tokenCacheTTL),
		sessionSecret: sessionSecret,
	}
}

// ValidateToken validates a bearer token against the Kubernetes TokenReview API.
// Results are cached for the configured TTL to reduce API server load.
func (s *Service) ValidateToken(ctx context.Context, token string) (*UserInfo, error) {
	// Check cache first.
	if cached := s.tokenCache.get(token); cached != nil {
		return cached, nil
	}

	// Submit a TokenReview to the Kubernetes API server.
	review := &authv1.TokenReview{
		Spec: authv1.TokenReviewSpec{
			Token: token,
		},
	}

	result, err := s.k8sClient.Clientset.AuthenticationV1().TokenReviews().Create(
		ctx, review, metav1.CreateOptions{},
	)
	if err != nil {
		return nil, fmt.Errorf("token review request failed: %w", err)
	}

	if !result.Status.Authenticated {
		return nil, fmt.Errorf("token is not valid")
	}

	// Convert Extra from map[string]ExtraValue to map[string][]string.
	extra := make(map[string][]string, len(result.Status.User.Extra))
	for k, v := range result.Status.User.Extra {
		extra[k] = v
	}

	user := &UserInfo{
		Username: result.Status.User.Username,
		UID:      result.Status.User.UID,
		Groups:   result.Status.User.Groups,
		Extra:    extra,
	}

	// Cache the result.
	s.tokenCache.set(token, user)

	return user, nil
}

// SessionStore returns the session store managed by this service.
func (s *Service) Sessions() *SessionStore {
	return s.sessionStore
}

// Secret returns the session encryption secret.
func (s *Service) Secret() string {
	return s.sessionSecret
}
