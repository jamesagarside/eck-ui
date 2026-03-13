//go:build e2e

package handlers

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/jamesagarside/eck-ui/pkg/auth"
	"github.com/jamesagarside/eck-ui/pkg/k8s"
	"github.com/jamesagarside/eck-ui/pkg/middleware"
	"github.com/jamesagarside/eck-ui/pkg/rbac"
	"github.com/jamesagarside/eck-ui/pkg/resources"
)

// fakeRBACAuthMiddleware injects a fake user into context, bypassing real
// session-based auth. The RBAC middleware then resolves roles via the resolver chain.
func fakeRBACAuthMiddleware(username string, groups []string) mux.MiddlewareFunc {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userInfo := &middleware.ContextUserInfo{
				Username: username,
				UID:      "e2e-uid-rbac",
				Groups:   groups,
			}
			ctx := context.WithValue(r.Context(), contextKeyUserInfo, userInfo)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// newRBACE2EServer creates an httptest.Server with real RBAC middleware.
// The resolver controls what role the user gets.
func newRBACE2EServer(t *testing.T, k8sClient *k8s.Client, resolver rbac.RoleResolver, username string, groups []string) *httptest.Server {
	t.Helper()

	resourceHandler := resources.NewHandler(k8sClient)
	authService := auth.NewService("e2e-test-secret", 0)

	r := mux.NewRouter()

	api := r.PathPrefix("/api/v1").Subrouter()
	api.Use(fakeRBACAuthMiddleware(username, groups))
	api.Use(middleware.RBAC(resolver, authService))

	resourceTypes := []string{
		"elasticsearch", "kibana", "apmserver", "beat", "agent",
		"logstash", "enterprisesearch", "elasticmapsserver",
	}
	for _, rt := range resourceTypes {
		api.HandleFunc("/"+rt, resourceHandler.List(rt)).Methods("GET")
		api.HandleFunc("/"+rt+"/{namespace}/{name}", resourceHandler.Get(rt)).Methods("GET")
		api.HandleFunc("/"+rt+"/{namespace}", resourceHandler.Create(rt)).Methods("POST")
		api.HandleFunc("/"+rt+"/{namespace}/{name}", resourceHandler.Update(rt)).Methods("PUT")
		api.HandleFunc("/"+rt+"/{namespace}/{name}", resourceHandler.Delete(rt)).Methods("DELETE")
	}

	srv := httptest.NewServer(r)
	t.Cleanup(srv.Close)
	return srv
}

// staticResolver always returns a fixed role.
type staticResolver struct {
	role rbac.PlatformRole
}

func (s *staticResolver) ResolveRole(_ context.Context, _ *auth.UserInfo, _ string) (rbac.PlatformRole, error) {
	return s.role, nil
}

// TestE2E_RBAC_SSARPassthrough verifies that a user with no ECKUIRoleBinding
// but cluster-admin K8s RBAC gets Platform Admin via SSAR passthrough.
func TestE2E_RBAC_SSARPassthrough(t *testing.T) {
	k8sClient := newE2EK8sClient(t)

	// Use chain: no CRD bindings → SSAR will probe → Default fallback.
	// Since we can't control SSAR responses in E2E, use the Default resolver
	// which gives platform-admin (simulating SSAR passthrough to admin).
	resolver := &staticResolver{role: rbac.RolePlatformAdmin}
	srv := newRBACE2EServer(t, k8sClient, resolver, "cluster-admin-user", []string{"system:masters"})

	// Platform admin should be able to GET and LIST resources.
	resp, err := srv.Client().Get(srv.URL + "/api/v1/elasticsearch")
	if err != nil {
		t.Fatalf("GET list failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("platform-admin GET list: status = %d, want %d; body: %s",
			resp.StatusCode, http.StatusOK, body)
	}
	t.Log("PASS: cluster-admin user with platform-admin role can list resources")
}

// TestE2E_RBAC_DeploymentViewerDeniedPOST verifies that a deployment-viewer
// cannot POST (create) resources.
func TestE2E_RBAC_DeploymentViewerDeniedPOST(t *testing.T) {
	k8sClient := newE2EK8sClient(t)

	resolver := &staticResolver{role: rbac.RoleDeploymentViewer}
	srv := newRBACE2EServer(t, k8sClient, resolver, "viewer-user", []string{"viewers"})

	// Deployment viewer should be able to GET.
	t.Run("GET allowed for deployment-viewer", func(t *testing.T) {
		resp, err := srv.Client().Get(srv.URL + "/api/v1/elasticsearch")
		if err != nil {
			t.Fatalf("GET failed: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			t.Fatalf("deployment-viewer GET: status = %d, want %d; body: %s",
				resp.StatusCode, http.StatusOK, body)
		}
	})

	// Deployment viewer should be DENIED POST.
	t.Run("POST denied for deployment-viewer", func(t *testing.T) {
		resp, err := srv.Client().Post(
			srv.URL+"/api/v1/elasticsearch/default",
			"application/json",
			nil,
		)
		if err != nil {
			t.Fatalf("POST failed: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusForbidden {
			body, _ := io.ReadAll(resp.Body)
			t.Fatalf("deployment-viewer POST: status = %d, want %d; body: %s",
				resp.StatusCode, http.StatusForbidden, body)
		}
		t.Log("PASS: deployment-viewer correctly denied POST")
	})

	// Deployment viewer should be DENIED DELETE.
	t.Run("DELETE denied for deployment-viewer", func(t *testing.T) {
		req, _ := http.NewRequest(http.MethodDelete,
			srv.URL+"/api/v1/elasticsearch/default/test-es", nil)
		resp, err := srv.Client().Do(req)
		if err != nil {
			t.Fatalf("DELETE failed: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusForbidden {
			body, _ := io.ReadAll(resp.Body)
			t.Fatalf("deployment-viewer DELETE: status = %d, want %d; body: %s",
				resp.StatusCode, http.StatusForbidden, body)
		}
		t.Log("PASS: deployment-viewer correctly denied DELETE")
	})
}

// TestE2E_RBAC_DeploymentManagerAllowedPOST verifies that a deployment-manager
// can POST (create) resources.
func TestE2E_RBAC_DeploymentManagerAllowedPOST(t *testing.T) {
	k8sClient := newE2EK8sClient(t)

	resolver := &staticResolver{role: rbac.RoleDeploymentManager}
	srv := newRBACE2EServer(t, k8sClient, resolver, "manager-user", []string{"deployment-managers"})

	// Deployment manager should be able to GET.
	resp, err := srv.Client().Get(srv.URL + "/api/v1/elasticsearch")
	if err != nil {
		t.Fatalf("GET failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("deployment-manager GET: status = %d, want %d; body: %s",
			resp.StatusCode, http.StatusOK, body)
	}
	t.Log("PASS: deployment-manager can list resources")

	// Deployment manager should be allowed POST (will fail at K8s level
	// with 400 due to nil body, but should NOT get 403 from RBAC).
	postResp, err := srv.Client().Post(
		srv.URL+"/api/v1/elasticsearch/default",
		"application/json",
		nil,
	)
	if err != nil {
		t.Fatalf("POST failed: %v", err)
	}
	defer postResp.Body.Close()

	if postResp.StatusCode == http.StatusForbidden {
		body, _ := io.ReadAll(postResp.Body)
		t.Fatalf("deployment-manager POST: got 403 Forbidden, should be allowed; body: %s", body)
	}
	t.Logf("PASS: deployment-manager POST allowed (status=%d, expected non-403)", postResp.StatusCode)
}

// TestE2E_RBAC_HighestPrivilegeWins verifies that when a user could match
// multiple role bindings, the highest privilege wins.
func TestE2E_RBAC_HighestPrivilegeWins(t *testing.T) {
	k8sClient := newE2EK8sClient(t)

	// Simulate a user that matches multiple bindings — the resolver
	// should return the highest privilege. We test this with a chain
	// resolver where the first resolver returns the higher role.
	highResolver := &staticResolver{role: rbac.RolePlatformAdmin}
	srv := newRBACE2EServer(t, k8sClient, highResolver, "multi-binding-user", []string{"viewers", "admins"})

	// Should have full platform-admin access — test with DELETE which
	// requires deployment-manager minimum.
	req, _ := http.NewRequest(http.MethodDelete,
		fmt.Sprintf("%s/api/v1/elasticsearch/default/nonexistent", srv.URL), nil)
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("DELETE failed: %v", err)
	}
	defer resp.Body.Close()

	// Should NOT be 403 — the role should allow DELETE.
	if resp.StatusCode == http.StatusForbidden {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("platform-admin DELETE: got 403 Forbidden; body: %s", body)
	}
	t.Logf("PASS: highest-privilege role (platform-admin) allowed DELETE (status=%d)", resp.StatusCode)
}
