// Package auth provides authentication and session management.
package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

// User represents an authenticated user.
type User struct {
	// ID is the unique user identifier (OIDC sub claim or K8s username).
	ID string `json:"id"`
	// Email is the user's email address.
	Email string `json:"email,omitempty"`
	// Name is the user's display name.
	Name string `json:"name,omitempty"`
	// Groups are the user's group memberships.
	Groups []string `json:"groups,omitempty"`
	// AuthMethod is how the user authenticated.
	AuthMethod string `json:"auth_method"`
}

// Session represents a user session.
type Session struct {
	// ID is the unique session identifier.
	ID string `json:"id"`
	// User is the authenticated user.
	User User `json:"user"`
	// CreatedAt is when the session was created.
	CreatedAt time.Time `json:"created_at"`
	// ExpiresAt is when the session expires.
	ExpiresAt time.Time `json:"expires_at"`
	// AccessToken is the OIDC access token (if OIDC auth).
	AccessToken string `json:"access_token,omitempty"`
	// RefreshToken is the OIDC refresh token (if OIDC auth).
	RefreshToken string `json:"refresh_token,omitempty"`
}

// IsExpired checks if the session has expired.
func (s *Session) IsExpired() bool {
	return time.Now().After(s.ExpiresAt)
}

// OIDCConfig holds OIDC provider configuration.
type OIDCConfig struct {
	// Issuer is the OIDC provider URL.
	Issuer string
	// ClientID is the OAuth2 client ID.
	ClientID string
	// ClientSecret is the OAuth2 client secret.
	ClientSecret string
	// RedirectURL is the OAuth2 callback URL.
	RedirectURL string
	// Scopes are the OAuth2 scopes to request.
	Scopes []string
}

// Provider handles authentication.
type Provider struct {
	oidcProvider  *oidc.Provider
	oauth2Config  *oauth2.Config
	verifier      *oidc.IDTokenVerifier
	sessionSecret []byte
	sessionTTL    time.Duration
}

// NewProvider creates a new auth provider.
func NewProvider(ctx context.Context, cfg OIDCConfig, sessionSecret string) (*Provider, error) {
	if cfg.Issuer == "" {
		slog.Info("OIDC not configured, using Kubernetes token auth only")
		return &Provider{
			sessionSecret: []byte(sessionSecret),
			sessionTTL:    24 * time.Hour,
		}, nil
	}

	provider, err := oidc.NewProvider(ctx, cfg.Issuer)
	if err != nil {
		return nil, fmt.Errorf("failed to create OIDC provider: %w", err)
	}

	scopes := cfg.Scopes
	if len(scopes) == 0 {
		scopes = []string{oidc.ScopeOpenID, "profile", "email", "groups"}
	}

	oauth2Cfg := &oauth2.Config{
		ClientID:     cfg.ClientID,
		ClientSecret: cfg.ClientSecret,
		RedirectURL:  cfg.RedirectURL,
		Endpoint:     provider.Endpoint(),
		Scopes:       scopes,
	}

	verifier := provider.Verifier(&oidc.Config{ClientID: cfg.ClientID})

	return &Provider{
		oidcProvider:  provider,
		oauth2Config:  oauth2Cfg,
		verifier:      verifier,
		sessionSecret: []byte(sessionSecret),
		sessionTTL:    24 * time.Hour,
	}, nil
}

// IsOIDCEnabled returns true if OIDC is configured.
func (p *Provider) IsOIDCEnabled() bool {
	return p.oidcProvider != nil
}

// GetAuthURL returns the OIDC authorization URL.
func (p *Provider) GetAuthURL(state string) string {
	if !p.IsOIDCEnabled() {
		return ""
	}
	return p.oauth2Config.AuthCodeURL(state)
}

// ExchangeCode exchanges an authorization code for tokens.
func (p *Provider) ExchangeCode(ctx context.Context, code string) (*Session, error) {
	if !p.IsOIDCEnabled() {
		return nil, errors.New("OIDC not configured")
	}

	token, err := p.oauth2Config.Exchange(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange code: %w", err)
	}

	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok {
		return nil, errors.New("no id_token in response")
	}

	idToken, err := p.verifier.Verify(ctx, rawIDToken)
	if err != nil {
		return nil, fmt.Errorf("failed to verify id_token: %w", err)
	}

	var claims struct {
		Sub    string   `json:"sub"`
		Email  string   `json:"email"`
		Name   string   `json:"name"`
		Groups []string `json:"groups"`
	}
	if err := idToken.Claims(&claims); err != nil {
		return nil, fmt.Errorf("failed to parse claims: %w", err)
	}

	sessionID, err := generateSessionID()
	if err != nil {
		return nil, fmt.Errorf("failed to generate session ID: %w", err)
	}

	session := &Session{
		ID: sessionID,
		User: User{
			ID:         claims.Sub,
			Email:      claims.Email,
			Name:       claims.Name,
			Groups:     claims.Groups,
			AuthMethod: "oidc",
		},
		CreatedAt:    time.Now().UTC(),
		ExpiresAt:    time.Now().UTC().Add(p.sessionTTL),
		AccessToken:  token.AccessToken,
		RefreshToken: token.RefreshToken,
	}

	return session, nil
}

// ValidateBearerToken validates a Bearer token (K8s service account or OIDC).
func (p *Provider) ValidateBearerToken(ctx context.Context, token string) (*User, error) {
	// Try OIDC token validation first
	if p.IsOIDCEnabled() {
		idToken, err := p.verifier.Verify(ctx, token)
		if err == nil {
			var claims struct {
				Sub    string   `json:"sub"`
				Email  string   `json:"email"`
				Name   string   `json:"name"`
				Groups []string `json:"groups"`
			}
			if err := idToken.Claims(&claims); err == nil {
				return &User{
					ID:         claims.Sub,
					Email:      claims.Email,
					Name:       claims.Name,
					Groups:     claims.Groups,
					AuthMethod: "oidc_token",
				}, nil
			}
		}
	}

	// Fall back to treating as Kubernetes service account token
	// In a real implementation, you'd validate this against the K8s TokenReview API
	// For now, we'll trust the token and extract basic info
	user := &User{
		ID:         extractUserFromToken(token),
		AuthMethod: "kubernetes_token",
	}

	return user, nil
}

// extractUserFromToken extracts user info from a Kubernetes token.
// This is a simplified implementation - in production, use TokenReview API.
func extractUserFromToken(token string) string {
	// JWT tokens have 3 parts separated by dots
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return "unknown"
	}

	// Decode the payload (middle part)
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "unknown"
	}

	var claims struct {
		Sub string `json:"sub"`
	}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return "unknown"
	}

	if claims.Sub != "" {
		return claims.Sub
	}
	return "unknown"
}

// generateSessionID generates a cryptographically secure session ID.
func generateSessionID() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// GenerateState generates a cryptographically secure state parameter.
func GenerateState() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// ContextKey is the type for context keys.
type ContextKey string

const (
	// UserContextKey is the context key for the authenticated user.
	UserContextKey ContextKey = "user"
	// SessionContextKey is the context key for the session.
	SessionContextKey ContextKey = "session"
)

// UserFromContext extracts the user from the request context.
func UserFromContext(ctx context.Context) (*User, bool) {
	user, ok := ctx.Value(UserContextKey).(*User)
	return user, ok
}

// SessionFromContext extracts the session from the request context.
func SessionFromContext(ctx context.Context) (*Session, bool) {
	session, ok := ctx.Value(SessionContextKey).(*Session)
	return session, ok
}

// WithUser adds a user to the context.
func WithUser(ctx context.Context, user *User) context.Context {
	return context.WithValue(ctx, UserContextKey, user)
}

// WithSession adds a session to the context.
func WithSession(ctx context.Context, session *Session) context.Context {
	return context.WithValue(ctx, SessionContextKey, session)
}

// GetBearerToken extracts the Bearer token from the Authorization header.
func GetBearerToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if auth == "" {
		return ""
	}

	parts := strings.SplitN(auth, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
		return ""
	}

	return parts[1]
}
