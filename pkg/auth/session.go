package auth

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"sync"
	"time"
)

const (
	// SessionCookieName is the name of the HTTP cookie that holds the session ID.
	SessionCookieName = "eck-ui-session"

	// SessionDuration is the default session lifetime.
	SessionDuration = 8 * time.Hour
)

// Session holds the server-side session state for an authenticated user.
type Session struct {
	ID           string            `json:"id"`
	User         *UserInfo         `json:"user"`
	Organization string            `json:"organization,omitempty"`
	Role         string            `json:"role,omitempty"`
	Roles        map[string]string `json:"roles,omitempty"`
	CreatedAt    time.Time         `json:"createdAt"`
	ExpiresAt    time.Time         `json:"expiresAt"`
}

// IsExpired returns true if the session has passed its expiry time.
func (s *Session) IsExpired() bool {
	return time.Now().After(s.ExpiresAt)
}

// SessionStore provides thread-safe in-memory session storage.
type SessionStore struct {
	mu       sync.RWMutex
	sessions sync.Map
}

// NewSessionStore creates a new empty SessionStore.
func NewSessionStore() *SessionStore {
	return &SessionStore{}
}

// Create generates a new session for the given user and returns it.
// The session is stored in memory and will expire after SessionDuration.
func (ss *SessionStore) Create(user *UserInfo) (*Session, error) {
	id, err := generateSessionID()
	if err != nil {
		return nil, err
	}

	now := time.Now()
	session := &Session{
		ID:        id,
		User:      user,
		CreatedAt: now,
		ExpiresAt: now.Add(SessionDuration),
	}

	ss.sessions.Store(id, session)
	return session, nil
}

// Get retrieves a session by its ID. Returns nil if the session does not exist
// or has expired. Expired sessions are automatically cleaned up.
func (ss *SessionStore) Get(id string) *Session {
	val, ok := ss.sessions.Load(id)
	if !ok {
		return nil
	}

	session := val.(*Session)
	if session.IsExpired() {
		ss.sessions.Delete(id)
		return nil
	}

	return session
}

// Delete removes a session by its ID.
func (ss *SessionStore) Delete(id string) {
	ss.sessions.Delete(id)
}

// GetFromRequest extracts the session ID from the request cookie and returns
// the corresponding session. Returns nil if the cookie is missing or the
// session is invalid/expired.
func (ss *SessionStore) GetFromRequest(r *http.Request) *Session {
	cookie, err := r.Cookie(SessionCookieName)
	if err != nil {
		return nil
	}
	return ss.Get(cookie.Value)
}

// SetCookie writes the session cookie to the response. The cookie is configured
// with HTTP-only, SameSite=Lax, and path=/ for security. Secure flag is set
// based on the request scheme (HTTPS only).
func SetCookie(w http.ResponseWriter, session *Session, secure bool) {
	sameSite := http.SameSiteLaxMode
	if secure {
		sameSite = http.SameSiteStrictMode
	}
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    session.ID,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: sameSite,
		Expires:  session.ExpiresAt,
	})
}

// ClearCookie removes the session cookie from the response by setting it to
// an expired value.
func ClearCookie(w http.ResponseWriter, secure bool) {
	sameSite := http.SameSiteLaxMode
	if secure {
		sameSite = http.SameSiteStrictMode
	}
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: sameSite,
		MaxAge:   -1,
	})
}

// SetOrganization updates the organization context for a session.
func (ss *SessionStore) SetOrganization(id, org string) {
	val, ok := ss.sessions.Load(id)
	if !ok {
		return
	}
	session := val.(*Session)
	session.Organization = org
	ss.sessions.Store(id, session)
}

// generateSessionID creates a cryptographically random 32-byte hex-encoded session ID.
func generateSessionID() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
