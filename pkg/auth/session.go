// Package auth provides authentication and session management.
package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"

	"github.com/jamesagarside/eck-ui/pkg/k8s"
)

const (
	// SessionSecretPrefix is the prefix for session secrets.
	SessionSecretPrefix = "eck-ui-session-"
	// SessionLabelManagedBy indicates management by ECK UI.
	SessionLabelManagedBy = "app.kubernetes.io/managed-by"
	// SessionLabelComponent indicates the component type.
	SessionLabelComponent = "app.kubernetes.io/component"
)

// SessionStore manages user sessions.
type SessionStore interface {
	// Get retrieves a session by ID.
	Get(ctx context.Context, id string) (*Session, error)
	// Save saves a session.
	Save(ctx context.Context, session *Session) error
	// Delete deletes a session.
	Delete(ctx context.Context, id string) error
	// Cleanup removes expired sessions.
	Cleanup(ctx context.Context) error
}

// InMemorySessionStore stores sessions in memory.
// Suitable for development and single-replica deployments.
type InMemorySessionStore struct {
	sessions map[string]*Session
	mu       sync.RWMutex
}

// NewInMemorySessionStore creates a new in-memory session store.
func NewInMemorySessionStore() *InMemorySessionStore {
	return &InMemorySessionStore{
		sessions: make(map[string]*Session),
	}
}

// Get retrieves a session by ID.
func (s *InMemorySessionStore) Get(ctx context.Context, id string) (*Session, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	session, ok := s.sessions[id]
	if !ok {
		return nil, fmt.Errorf("session not found: %s", id)
	}

	if session.IsExpired() {
		return nil, fmt.Errorf("session expired: %s", id)
	}

	return session, nil
}

// Save saves a session.
func (s *InMemorySessionStore) Save(ctx context.Context, session *Session) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.sessions[session.ID] = session
	return nil
}

// Delete deletes a session.
func (s *InMemorySessionStore) Delete(ctx context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.sessions, id)
	return nil
}

// Cleanup removes expired sessions.
func (s *InMemorySessionStore) Cleanup(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for id, session := range s.sessions {
		if session.IsExpired() {
			delete(s.sessions, id)
		}
	}
	return nil
}

// KubernetesSessionStore stores sessions in Kubernetes Secrets.
// Suitable for multi-replica deployments.
type KubernetesSessionStore struct {
	client    kubernetes.Interface
	namespace string
}

// NewKubernetesSessionStore creates a new Kubernetes-backed session store.
func NewKubernetesSessionStore(namespace string) (*KubernetesSessionStore, error) {
	k8sClient, err := k8s.NewClient()
	if err != nil {
		return nil, err
	}
	return &KubernetesSessionStore{
		client:    k8sClient.Clientset,
		namespace: namespace,
	}, nil
}

// secretName returns the Secret name for a session ID.
func secretName(id string) string {
	// Use a hash prefix to avoid secret name collisions
	return SessionSecretPrefix + id[:16]
}

// Get retrieves a session by ID.
func (s *KubernetesSessionStore) Get(ctx context.Context, id string) (*Session, error) {
	secret, err := s.client.CoreV1().Secrets(s.namespace).Get(ctx, secretName(id), metav1.GetOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil, fmt.Errorf("session not found: %s", id)
		}
		return nil, fmt.Errorf("failed to get session: %w", err)
	}

	sessionData, ok := secret.Data["session"]
	if !ok {
		return nil, fmt.Errorf("invalid session secret: %s", id)
	}

	var session Session
	if err := json.Unmarshal(sessionData, &session); err != nil {
		return nil, fmt.Errorf("failed to unmarshal session: %w", err)
	}

	if session.IsExpired() {
		// Clean up expired session
		_ = s.Delete(ctx, id)
		return nil, fmt.Errorf("session expired: %s", id)
	}

	return &session, nil
}

// Save saves a session.
func (s *KubernetesSessionStore) Save(ctx context.Context, session *Session) error {
	sessionData, err := json.Marshal(session)
	if err != nil {
		return fmt.Errorf("failed to marshal session: %w", err)
	}

	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      secretName(session.ID),
			Namespace: s.namespace,
			Labels: map[string]string{
				SessionLabelManagedBy: "eck-ui",
				SessionLabelComponent: "session",
			},
		},
		Type: corev1.SecretTypeOpaque,
		Data: map[string][]byte{
			"session": sessionData,
		},
	}

	_, err = s.client.CoreV1().Secrets(s.namespace).Create(ctx, secret, metav1.CreateOptions{})
	if err != nil {
		if apierrors.IsAlreadyExists(err) {
			// Update existing session
			_, err = s.client.CoreV1().Secrets(s.namespace).Update(ctx, secret, metav1.UpdateOptions{})
			if err != nil {
				return fmt.Errorf("failed to update session: %w", err)
			}
			return nil
		}
		return fmt.Errorf("failed to create session: %w", err)
	}

	return nil
}

// Delete deletes a session.
func (s *KubernetesSessionStore) Delete(ctx context.Context, id string) error {
	err := s.client.CoreV1().Secrets(s.namespace).Delete(ctx, secretName(id), metav1.DeleteOptions{})
	if err != nil && !apierrors.IsNotFound(err) {
		return fmt.Errorf("failed to delete session: %w", err)
	}
	return nil
}

// Cleanup removes expired sessions.
func (s *KubernetesSessionStore) Cleanup(ctx context.Context) error {
	secrets, err := s.client.CoreV1().Secrets(s.namespace).List(ctx, metav1.ListOptions{
		LabelSelector: fmt.Sprintf("%s=eck-ui,%s=session", SessionLabelManagedBy, SessionLabelComponent),
	})
	if err != nil {
		return fmt.Errorf("failed to list sessions: %w", err)
	}

	for _, secret := range secrets.Items {
		sessionData, ok := secret.Data["session"]
		if !ok {
			continue
		}

		var session Session
		if err := json.Unmarshal(sessionData, &session); err != nil {
			continue
		}

		if session.IsExpired() {
			_ = s.client.CoreV1().Secrets(s.namespace).Delete(ctx, secret.Name, metav1.DeleteOptions{})
		}
	}

	return nil
}

// StartSessionCleanup starts a background goroutine to clean up expired sessions.
func StartSessionCleanup(ctx context.Context, store SessionStore, interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := store.Cleanup(ctx); err != nil {
					// Log error but continue
				}
			}
		}
	}()
}
