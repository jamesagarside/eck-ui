package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/jamesagarside/eck-ui/pkg/auth"
	apierrors "github.com/jamesagarside/eck-ui/pkg/errors"
	"github.com/jamesagarside/eck-ui/pkg/k8s"
	"github.com/jamesagarside/eck-ui/pkg/organization"
)

// loginRequest is the expected JSON body for POST /api/v1/auth/login.
type loginRequest struct {
	Token string `json:"token"`
}

// orgResponse is a simplified organization for API responses.
type orgResponse struct {
	Name       string   `json:"name"`
	Namespaces []string `json:"namespaces"`
}

// loginResponse is the JSON body returned after successful authentication.
type loginResponse struct {
	User               *auth.UserInfo `json:"user"`
	Session            string         `json:"session"`
	Organizations      []orgResponse  `json:"organizations"`
	ActiveOrganization string         `json:"activeOrganization"`
}

// sessionResponse is the JSON body returned by GET /api/v1/auth/session.
type sessionResponse struct {
	User               *auth.UserInfo `json:"user"`
	Organizations      []orgResponse  `json:"organizations"`
	ActiveOrganization string         `json:"activeOrganization"`
	ExpiresAt          string         `json:"expiresAt"`
}

// HealthzHandler returns 200 OK unconditionally, indicating the process is alive.
func HealthzHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// ReadyzHandler returns a handler that checks Kubernetes API server connectivity.
// It returns 200 OK if the API server is reachable, or 503 Service Unavailable otherwise.
func ReadyzHandler(k8sClient *k8s.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")

		if err := k8sClient.CheckHealth(); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]string{
				"status": "unavailable",
				"error":  err.Error(),
			})
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
	}
}

// LoginHandler returns a handler that validates a bearer token via the Kubernetes
// TokenReview API, creates a session, and sets the session cookie.
func LoginHandler(authService *auth.Service, orgStore *organization.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req loginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			apierrors.WriteError(w, apierrors.New(
				http.StatusBadRequest,
				"BadRequest",
				"Invalid request body: expected JSON with 'token' field.",
			))
			return
		}

		if req.Token == "" {
			apierrors.WriteError(w, apierrors.New(
				http.StatusBadRequest,
				"BadRequest",
				"Token is required.",
			))
			return
		}

		userInfo, err := authService.ValidateToken(r.Context(), req.Token)
		if err != nil {
			apierrors.WriteError(w, apierrors.New(
				http.StatusUnauthorized,
				"Unauthorized",
				"Token validation failed: "+err.Error(),
			))
			return
		}

		session, err := authService.Sessions().Create(userInfo)
		if err != nil {
			apierrors.WriteError(w, apierrors.New(
				http.StatusInternalServerError,
				"InternalError",
				"Failed to create session.",
			))
			return
		}

		auth.SetCookie(w, session)

		// Build organizations list for the user.
		orgs := orgStore.GetUserOrganizations(userInfo.Username)
		orgList := make([]orgResponse, 0, len(orgs))
		for _, o := range orgs {
			orgList = append(orgList, orgResponse{
				Name:       o.Name,
				Namespaces: o.Namespaces,
			})
		}

		// If no orgs configured, provide a default org with all-namespace access.
		activeOrg := ""
		if len(orgList) == 0 {
			orgList = []orgResponse{{Name: "default", Namespaces: []string{"*"}}}
		}
		activeOrg = orgList[0].Name

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(loginResponse{
			User:               userInfo,
			Session:            session.ID,
			Organizations:      orgList,
			ActiveOrganization: activeOrg,
		})
	}
}

// LogoutHandler returns a handler that deletes the current session and clears
// the session cookie.
func LogoutHandler(authService *auth.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		session := authService.Sessions().GetFromRequest(r)
		if session != nil {
			authService.Sessions().Delete(session.ID)
		}

		auth.ClearCookie(w)

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "logged_out"})
	}
}

// SessionHandler returns a handler that retrieves the current session information
// from the session cookie.
func SessionHandler(authService *auth.Service, orgStore *organization.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		session := authService.Sessions().GetFromRequest(r)
		if session == nil {
			apierrors.WriteError(w, apierrors.ErrUnauthorized)
			return
		}

		orgs := orgStore.GetUserOrganizations(session.User.Username)
		orgList := make([]orgResponse, 0, len(orgs))
		for _, o := range orgs {
			orgList = append(orgList, orgResponse{
				Name:       o.Name,
				Namespaces: o.Namespaces,
			})
		}
		if len(orgList) == 0 {
			orgList = []orgResponse{{Name: "default", Namespaces: []string{"*"}}}
		}
		activeOrg := session.Organization
		if activeOrg == "" {
			activeOrg = orgList[0].Name
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(sessionResponse{
			User:               session.User,
			Organizations:      orgList,
			ActiveOrganization: activeOrg,
			ExpiresAt:          session.ExpiresAt.Format("2006-01-02T15:04:05Z"),
		})
	}
}
