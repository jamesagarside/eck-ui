package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/jamesagarside/eck-ui/pkg/clusters"
	"github.com/jamesagarside/eck-ui/pkg/middleware"
	"github.com/jamesagarside/eck-ui/pkg/rbac"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic/fake"
	k8sfake "k8s.io/client-go/kubernetes/fake"
)

// clusterGVR is the GVR for ECKUICluster CRDs, used to register the list kind
// with the fake dynamic client.
var clusterGVR = schema.GroupVersionResource{
	Group:    clusters.Group,
	Version:  clusters.Version,
	Resource: clusters.Resource,
}

// newTestClusterManager creates a ClusterManager with no real K8s clients.
func newTestClusterManager() *clusters.ClusterManager {
	return clusters.NewClusterManager(nil, nil)
}

// testCluster creates an ECKUICluster suitable for testing.
func testCluster(name, namespace string, allowedGroups []string) *clusters.ECKUICluster {
	return &clusters.ECKUICluster{
		Name:      name,
		Namespace: namespace,
		Spec: clusters.ECKUIClusterSpec{
			APIServerURL:  "https://" + name + ":6443",
			DisplayName:   name + "-display",
			AllowedGroups: allowedGroups,
		},
		Status: clusters.ECKUIClusterStatus{
			Phase:           clusters.PhaseConnected,
			LastHealthCheck: "2025-01-01T00:00:00Z",
		},
	}
}

// withUserInfo returns a request with user info injected into context.
func withUserInfo(r *http.Request, username string, groups []string) *http.Request {
	ctx := middleware.WithUserInfo(r.Context(), &middleware.ContextUserInfo{
		Username: username,
		UID:      "uid-" + username,
		Groups:   groups,
	})
	return r.WithContext(ctx)
}

// withRole returns a request with the given platform role injected into context.
func withRole(r *http.Request, role rbac.PlatformRole) *http.Request {
	ctx := middleware.WithPlatformRole(r.Context(), role)
	return r.WithContext(ctx)
}

// withMuxVars returns a request with gorilla/mux route variables set.
func withMuxVars(r *http.Request, vars map[string]string) *http.Request {
	return mux.SetURLVars(r, vars)
}

// decodeJSON is a helper to decode a JSON response body.
func decodeJSON(t *testing.T, rec *httptest.ResponseRecorder, v interface{}) {
	t.Helper()
	if err := json.NewDecoder(rec.Body).Decode(v); err != nil {
		t.Fatalf("failed to decode JSON response: %v", err)
	}
}

// --- SingleClusterModeHandler ---

func TestSingleClusterModeHandler_Returns404(t *testing.T) {
	handler := SingleClusterModeHandler()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/clusters", nil)
	rec := httptest.NewRecorder()

	handler(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", res.StatusCode, http.StatusNotFound)
	}

	var body map[string]interface{}
	decodeJSON(t, rec, &body)

	if body["reason"] != "NotFound" {
		t.Errorf("reason = %v, want NotFound", body["reason"])
	}
	msg, _ := body["message"].(string)
	if msg != "multi-cluster mode is not enabled" {
		t.Errorf("message = %q, want %q", msg, "multi-cluster mode is not enabled")
	}
}

// --- isGroupAllowed ---

func TestIsGroupAllowed_EmptyAllowedGroups(t *testing.T) {
	if !isGroupAllowed([]string{"team-a"}, nil) {
		t.Error("expected true when allowedGroups is nil")
	}
	if !isGroupAllowed([]string{"team-a"}, []string{}) {
		t.Error("expected true when allowedGroups is empty")
	}
}

func TestIsGroupAllowed_MatchingGroup(t *testing.T) {
	if !isGroupAllowed([]string{"team-a", "team-b"}, []string{"team-b", "team-c"}) {
		t.Error("expected true when user has matching group")
	}
}

func TestIsGroupAllowed_NoMatch(t *testing.T) {
	if isGroupAllowed([]string{"team-a"}, []string{"team-b", "team-c"}) {
		t.Error("expected false when no groups match")
	}
}

func TestIsGroupAllowed_EmptyUserGroups(t *testing.T) {
	if isGroupAllowed(nil, []string{"team-a"}) {
		t.Error("expected false when user has no groups and allowedGroups is set")
	}
}

// --- toClusterResponse ---

func TestToClusterResponse_MapsFields(t *testing.T) {
	c := &clusters.ECKUICluster{
		Name:      "prod-cluster",
		Namespace: "eck-system",
		Spec: clusters.ECKUIClusterSpec{
			APIServerURL:  "https://prod:6443",
			DisplayName:   "Production",
			AllowedGroups: []string{"ops-team"},
			HealthCheck: clusters.HealthCheckConfig{
				IntervalSeconds: 60,
				TimeoutSeconds:  10,
			},
			CircuitBreaker: clusters.CircuitBreakerConfig{
				FailureThreshold: 5,
			},
		},
		Status: clusters.ECKUIClusterStatus{
			Phase:   clusters.PhaseConnected,
			Version: "v1.28.0",
		},
	}

	resp := toClusterResponse(c)

	if resp.Name != "prod-cluster" {
		t.Errorf("Name = %q, want %q", resp.Name, "prod-cluster")
	}
	if resp.Namespace != "eck-system" {
		t.Errorf("Namespace = %q, want %q", resp.Namespace, "eck-system")
	}
	if resp.DisplayName != "Production" {
		t.Errorf("DisplayName = %q, want %q", resp.DisplayName, "Production")
	}
	if resp.Spec.APIServerURL != "https://prod:6443" {
		t.Errorf("Spec.APIServerURL = %q, want %q", resp.Spec.APIServerURL, "https://prod:6443")
	}
	if len(resp.Spec.AllowedGroups) != 1 || resp.Spec.AllowedGroups[0] != "ops-team" {
		t.Errorf("Spec.AllowedGroups = %v, want [ops-team]", resp.Spec.AllowedGroups)
	}
	if resp.Status.Phase != clusters.PhaseConnected {
		t.Errorf("Status.Phase = %q, want %q", resp.Status.Phase, clusters.PhaseConnected)
	}
	if resp.Status.Version != "v1.28.0" {
		t.Errorf("Status.Version = %q, want %q", resp.Status.Version, "v1.28.0")
	}
}

func TestToClusterResponse_FallbackDisplayName(t *testing.T) {
	c := &clusters.ECKUICluster{
		Name:      "staging",
		Namespace: "default",
		Spec: clusters.ECKUIClusterSpec{
			APIServerURL: "https://staging:6443",
		},
	}

	resp := toClusterResponse(c)

	if resp.DisplayName != "staging" {
		t.Errorf("DisplayName = %q, want %q (fallback to Name)", resp.DisplayName, "staging")
	}
}

// --- ListClustersHandler ---

func TestListClustersHandler_NoUserInfo_Returns401(t *testing.T) {
	manager := newTestClusterManager()
	handler := ListClustersHandler(manager)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/clusters", nil)
	rec := httptest.NewRecorder()

	handler(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", res.StatusCode, http.StatusUnauthorized)
	}
}

func TestListClustersHandler_EmptyList(t *testing.T) {
	manager := newTestClusterManager()
	handler := ListClustersHandler(manager)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/clusters", nil)
	req = withUserInfo(req, "alice", []string{"team-a"})
	rec := httptest.NewRecorder()

	handler(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", res.StatusCode, http.StatusOK)
	}

	var body clusterListResponse
	decodeJSON(t, rec, &body)

	if len(body.Items) != 0 {
		t.Errorf("items count = %d, want 0", len(body.Items))
	}
	if body.SingleClusterMode {
		t.Error("expected singleClusterMode = false")
	}
}

func TestListClustersHandler_ReturnsAllowedClusters(t *testing.T) {
	manager := newTestClusterManager()
	manager.RegisterTestCluster(testCluster("cluster-a", "ns-a", nil))                       // no group restriction
	manager.RegisterTestCluster(testCluster("cluster-b", "ns-b", []string{"ops-team"}))       // restricted to ops-team
	manager.RegisterTestCluster(testCluster("cluster-c", "ns-c", []string{"dev-team"}))       // restricted to dev-team

	handler := ListClustersHandler(manager)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/clusters", nil)
	req = withUserInfo(req, "alice", []string{"ops-team"})
	rec := httptest.NewRecorder()

	handler(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", res.StatusCode, http.StatusOK)
	}

	var body clusterListResponse
	decodeJSON(t, rec, &body)

	// User in ops-team should see cluster-a (no restriction) and cluster-b (ops-team), but not cluster-c (dev-team).
	if len(body.Items) != 2 {
		t.Fatalf("items count = %d, want 2", len(body.Items))
	}

	names := make(map[string]bool)
	for _, item := range body.Items {
		names[item.Name] = true
	}
	if !names["cluster-a"] {
		t.Error("expected cluster-a in results (no group restriction)")
	}
	if !names["cluster-b"] {
		t.Error("expected cluster-b in results (user is in ops-team)")
	}
	if names["cluster-c"] {
		t.Error("did not expect cluster-c in results (user not in dev-team)")
	}
}

func TestListClustersHandler_NoGroupsUserSeesUnrestricted(t *testing.T) {
	manager := newTestClusterManager()
	manager.RegisterTestCluster(testCluster("open-cluster", "ns-a", nil))
	manager.RegisterTestCluster(testCluster("restricted-cluster", "ns-b", []string{"team-x"}))

	handler := ListClustersHandler(manager)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/clusters", nil)
	req = withUserInfo(req, "bob", nil)
	rec := httptest.NewRecorder()

	handler(rec, req)

	var body clusterListResponse
	decodeJSON(t, rec, &body)

	if len(body.Items) != 1 {
		t.Fatalf("items count = %d, want 1", len(body.Items))
	}
	if body.Items[0].Name != "open-cluster" {
		t.Errorf("expected open-cluster, got %q", body.Items[0].Name)
	}
}

// --- GetClusterHandler ---

func TestGetClusterHandler_NotFound(t *testing.T) {
	manager := newTestClusterManager()
	handler := GetClusterHandler(manager)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/clusters/nonexistent", nil)
	req = withMuxVars(req, map[string]string{"cluster": "nonexistent"})
	req = withUserInfo(req, "alice", []string{"team-a"})
	rec := httptest.NewRecorder()

	handler(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", res.StatusCode, http.StatusNotFound)
	}

	var body map[string]interface{}
	decodeJSON(t, rec, &body)

	if body["reason"] != "NotFound" {
		t.Errorf("reason = %v, want NotFound", body["reason"])
	}
}

func TestGetClusterHandler_Forbidden(t *testing.T) {
	manager := newTestClusterManager()
	manager.RegisterTestCluster(testCluster("restricted", "ns-a", []string{"admin-team"}))

	handler := GetClusterHandler(manager)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/clusters/restricted", nil)
	req = withMuxVars(req, map[string]string{"cluster": "restricted"})
	req = withUserInfo(req, "bob", []string{"dev-team"})
	rec := httptest.NewRecorder()

	handler(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", res.StatusCode, http.StatusForbidden)
	}

	var body map[string]interface{}
	decodeJSON(t, rec, &body)

	if body["reason"] != "Forbidden" {
		t.Errorf("reason = %v, want Forbidden", body["reason"])
	}
}

func TestGetClusterHandler_Success(t *testing.T) {
	manager := newTestClusterManager()
	manager.RegisterTestCluster(testCluster("prod", "ns-a", []string{"ops-team"}))

	handler := GetClusterHandler(manager)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/clusters/prod", nil)
	req = withMuxVars(req, map[string]string{"cluster": "prod"})
	req = withUserInfo(req, "alice", []string{"ops-team"})
	rec := httptest.NewRecorder()

	handler(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", res.StatusCode, http.StatusOK)
	}

	var body clusterResponse
	decodeJSON(t, rec, &body)

	if body.Name != "prod" {
		t.Errorf("Name = %q, want %q", body.Name, "prod")
	}
	if body.DisplayName != "prod-display" {
		t.Errorf("DisplayName = %q, want %q", body.DisplayName, "prod-display")
	}
}

func TestGetClusterHandler_NoGroupRestriction(t *testing.T) {
	manager := newTestClusterManager()
	manager.RegisterTestCluster(testCluster("open", "ns-a", nil))

	handler := GetClusterHandler(manager)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/clusters/open", nil)
	req = withMuxVars(req, map[string]string{"cluster": "open"})
	req = withUserInfo(req, "anyone", nil)
	rec := httptest.NewRecorder()

	handler(rec, req)

	if rec.Result().StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Result().StatusCode, http.StatusOK)
	}
}

// --- HealthCheckClusterHandler ---

func TestHealthCheckClusterHandler_NotFound(t *testing.T) {
	manager := newTestClusterManager()
	handler := HealthCheckClusterHandler(manager)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/clusters/unknown/health", nil)
	req = withMuxVars(req, map[string]string{"cluster": "unknown"})
	rec := httptest.NewRecorder()

	handler(rec, req)

	if rec.Result().StatusCode != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", rec.Result().StatusCode, http.StatusNotFound)
	}
}

func TestHealthCheckClusterHandler_ReturnsHealthData(t *testing.T) {
	manager := newTestClusterManager()
	c := testCluster("prod", "ns-a", nil)
	c.Status.Phase = clusters.PhaseConnected
	c.Status.LastHealthCheck = "2025-06-01T12:00:00Z"
	c.Status.LastError = ""
	manager.RegisterTestCluster(c)

	handler := HealthCheckClusterHandler(manager)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/clusters/prod/health", nil)
	req = withMuxVars(req, map[string]string{"cluster": "prod"})
	rec := httptest.NewRecorder()

	handler(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", res.StatusCode, http.StatusOK)
	}

	var body map[string]interface{}
	decodeJSON(t, rec, &body)

	if body["name"] != "prod" {
		t.Errorf("name = %v, want prod", body["name"])
	}
	if body["phase"] != clusters.PhaseConnected {
		t.Errorf("phase = %v, want %q", body["phase"], clusters.PhaseConnected)
	}
	if body["lastCheck"] != "2025-06-01T12:00:00Z" {
		t.Errorf("lastCheck = %v, want 2025-06-01T12:00:00Z", body["lastCheck"])
	}
}

func TestHealthCheckClusterHandler_DisconnectedCluster(t *testing.T) {
	manager := newTestClusterManager()
	c := testCluster("broken", "ns-a", nil)
	c.Status.Phase = clusters.PhaseDisconnected
	c.Status.LastError = "connection refused"
	manager.RegisterTestCluster(c)

	handler := HealthCheckClusterHandler(manager)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/clusters/broken/health", nil)
	req = withMuxVars(req, map[string]string{"cluster": "broken"})
	rec := httptest.NewRecorder()

	handler(rec, req)

	var body map[string]interface{}
	decodeJSON(t, rec, &body)

	if body["phase"] != clusters.PhaseDisconnected {
		t.Errorf("phase = %v, want %q", body["phase"], clusters.PhaseDisconnected)
	}
	if body["error"] != "connection refused" {
		t.Errorf("error = %v, want %q", body["error"], "connection refused")
	}
}

// --- CreateClusterHandler ---

func TestCreateClusterHandler_ForbiddenForNonAdmin(t *testing.T) {
	scheme := runtime.NewScheme()
	fakeDynamic := fake.NewSimpleDynamicClientWithCustomListKinds(scheme,
		map[schema.GroupVersionResource]string{
			clusterGVR: "ECKUIClusterList",
		},
	)
	fakeClientset := k8sfake.NewSimpleClientset()

	handler := CreateClusterHandler(fakeDynamic, fakeClientset)

	body := `{"name":"test","apiServerURL":"https://test:6443","credentialType":"token","credentialValue":"tok"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/clusters", bytes.NewBufferString(body))
	req = withUserInfo(req, "viewer-user", []string{"viewers"})
	req = withRole(req, rbac.RoleDeploymentViewer)
	rec := httptest.NewRecorder()

	handler(rec, req)

	if rec.Result().StatusCode != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", rec.Result().StatusCode, http.StatusForbidden)
	}

	var respBody map[string]interface{}
	decodeJSON(t, rec, &respBody)

	if respBody["reason"] != "Forbidden" {
		t.Errorf("reason = %v, want Forbidden", respBody["reason"])
	}
}

func TestCreateClusterHandler_ForbiddenForEditor(t *testing.T) {
	scheme := runtime.NewScheme()
	fakeDynamic := fake.NewSimpleDynamicClientWithCustomListKinds(scheme,
		map[schema.GroupVersionResource]string{
			clusterGVR: "ECKUIClusterList",
		},
	)
	fakeClientset := k8sfake.NewSimpleClientset()

	handler := CreateClusterHandler(fakeDynamic, fakeClientset)

	body := `{"name":"test","apiServerURL":"https://test:6443","credentialType":"token","credentialValue":"tok"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/clusters", bytes.NewBufferString(body))
	req = withUserInfo(req, "editor-user", []string{"editors"})
	req = withRole(req, rbac.RoleDeploymentManager)
	rec := httptest.NewRecorder()

	handler(rec, req)

	if rec.Result().StatusCode != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", rec.Result().StatusCode, http.StatusForbidden)
	}
}

func TestCreateClusterHandler_InvalidBody(t *testing.T) {
	scheme := runtime.NewScheme()
	fakeDynamic := fake.NewSimpleDynamicClientWithCustomListKinds(scheme,
		map[schema.GroupVersionResource]string{
			clusterGVR: "ECKUIClusterList",
		},
	)
	fakeClientset := k8sfake.NewSimpleClientset()

	handler := CreateClusterHandler(fakeDynamic, fakeClientset)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/clusters", bytes.NewBufferString("{invalid json"))
	req = withUserInfo(req, "admin-user", []string{"admins"})
	req = withRole(req, rbac.RolePlatformAdmin)
	rec := httptest.NewRecorder()

	handler(rec, req)

	if rec.Result().StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Result().StatusCode, http.StatusBadRequest)
	}
}

func TestCreateClusterHandler_MissingRequiredFields(t *testing.T) {
	scheme := runtime.NewScheme()
	fakeDynamic := fake.NewSimpleDynamicClientWithCustomListKinds(scheme,
		map[schema.GroupVersionResource]string{
			clusterGVR: "ECKUIClusterList",
		},
	)
	fakeClientset := k8sfake.NewSimpleClientset()

	handler := CreateClusterHandler(fakeDynamic, fakeClientset)

	// Missing credentialType and credentialValue.
	body := `{"name":"test","apiServerURL":"https://test:6443"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/clusters", bytes.NewBufferString(body))
	req = withUserInfo(req, "admin-user", []string{"admins"})
	req = withRole(req, rbac.RolePlatformAdmin)
	rec := httptest.NewRecorder()

	handler(rec, req)

	if rec.Result().StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Result().StatusCode, http.StatusBadRequest)
	}

	var respBody map[string]interface{}
	decodeJSON(t, rec, &respBody)

	msg, _ := respBody["message"].(string)
	if msg != "name, apiServerURL, credentialType, and credentialValue are required" {
		t.Errorf("message = %q, want required fields error", msg)
	}
}

func TestCreateClusterHandler_InvalidCredentialType(t *testing.T) {
	scheme := runtime.NewScheme()
	fakeDynamic := fake.NewSimpleDynamicClientWithCustomListKinds(scheme,
		map[schema.GroupVersionResource]string{
			clusterGVR: "ECKUIClusterList",
		},
	)
	fakeClientset := k8sfake.NewSimpleClientset()

	handler := CreateClusterHandler(fakeDynamic, fakeClientset)

	body := `{"name":"test","apiServerURL":"https://test:6443","credentialType":"password","credentialValue":"secret"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/clusters", bytes.NewBufferString(body))
	req = withUserInfo(req, "admin-user", []string{"admins"})
	req = withRole(req, rbac.RolePlatformAdmin)
	rec := httptest.NewRecorder()

	handler(rec, req)

	if rec.Result().StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Result().StatusCode, http.StatusBadRequest)
	}

	var respBody map[string]interface{}
	decodeJSON(t, rec, &respBody)

	msg, _ := respBody["message"].(string)
	if msg != "credentialType must be 'token' or 'kubeconfig'" {
		t.Errorf("message = %q, want credential type error", msg)
	}
}

func TestCreateClusterHandler_Success_Token(t *testing.T) {
	scheme := runtime.NewScheme()
	fakeDynamic := fake.NewSimpleDynamicClientWithCustomListKinds(scheme,
		map[schema.GroupVersionResource]string{
			clusterGVR: "ECKUIClusterList",
		},
	)
	fakeClientset := k8sfake.NewSimpleClientset()

	handler := CreateClusterHandler(fakeDynamic, fakeClientset)

	body := `{"name":"new-cluster","apiServerURL":"https://new:6443","credentialType":"token","credentialValue":"my-token","displayName":"New Cluster"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/clusters", bytes.NewBufferString(body))
	req = withUserInfo(req, "admin-user", []string{"admins"})
	req = withRole(req, rbac.RolePlatformAdmin)
	rec := httptest.NewRecorder()

	handler(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusCreated {
		t.Fatalf("status = %d, want %d", res.StatusCode, http.StatusCreated)
	}

	var respBody clusterResponse
	decodeJSON(t, rec, &respBody)

	if respBody.Name != "new-cluster" {
		t.Errorf("Name = %q, want %q", respBody.Name, "new-cluster")
	}
	if respBody.DisplayName != "New Cluster" {
		t.Errorf("DisplayName = %q, want %q", respBody.DisplayName, "New Cluster")
	}
	if respBody.Namespace != "eck-ui-system" {
		t.Errorf("Namespace = %q, want %q (default)", respBody.Namespace, "eck-ui-system")
	}
}

func TestCreateClusterHandler_DefaultNamespace(t *testing.T) {
	scheme := runtime.NewScheme()
	fakeDynamic := fake.NewSimpleDynamicClientWithCustomListKinds(scheme,
		map[schema.GroupVersionResource]string{
			clusterGVR: "ECKUIClusterList",
		},
	)
	fakeClientset := k8sfake.NewSimpleClientset()

	handler := CreateClusterHandler(fakeDynamic, fakeClientset)

	// No namespace specified; should default to "eck-ui-system".
	body := `{"name":"test","apiServerURL":"https://test:6443","credentialType":"token","credentialValue":"tok"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/clusters", bytes.NewBufferString(body))
	req = withUserInfo(req, "admin-user", []string{"admins"})
	req = withRole(req, rbac.RolePlatformAdmin)
	rec := httptest.NewRecorder()

	handler(rec, req)

	if rec.Result().StatusCode != http.StatusCreated {
		t.Fatalf("status = %d, want %d", rec.Result().StatusCode, http.StatusCreated)
	}

	var respBody clusterResponse
	decodeJSON(t, rec, &respBody)

	if respBody.Namespace != "eck-ui-system" {
		t.Errorf("Namespace = %q, want %q", respBody.Namespace, "eck-ui-system")
	}
}

// --- DeleteClusterHandler ---

func TestDeleteClusterHandler_ForbiddenForNonAdmin(t *testing.T) {
	scheme := runtime.NewScheme()
	fakeDynamic := fake.NewSimpleDynamicClientWithCustomListKinds(scheme,
		map[schema.GroupVersionResource]string{
			clusterGVR: "ECKUIClusterList",
		},
	)
	fakeClientset := k8sfake.NewSimpleClientset()

	handler := DeleteClusterHandler(fakeDynamic, fakeClientset)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/clusters/some-cluster", nil)
	req = withMuxVars(req, map[string]string{"cluster": "some-cluster"})
	req = withUserInfo(req, "viewer-user", []string{"viewers"})
	req = withRole(req, rbac.RoleDeploymentViewer)
	rec := httptest.NewRecorder()

	handler(rec, req)

	if rec.Result().StatusCode != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", rec.Result().StatusCode, http.StatusForbidden)
	}

	var respBody map[string]interface{}
	decodeJSON(t, rec, &respBody)

	if respBody["reason"] != "Forbidden" {
		t.Errorf("reason = %v, want Forbidden", respBody["reason"])
	}
}

func TestDeleteClusterHandler_ForbiddenForEditor(t *testing.T) {
	scheme := runtime.NewScheme()
	fakeDynamic := fake.NewSimpleDynamicClientWithCustomListKinds(scheme,
		map[schema.GroupVersionResource]string{
			clusterGVR: "ECKUIClusterList",
		},
	)
	fakeClientset := k8sfake.NewSimpleClientset()

	handler := DeleteClusterHandler(fakeDynamic, fakeClientset)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/clusters/some-cluster", nil)
	req = withMuxVars(req, map[string]string{"cluster": "some-cluster"})
	req = withUserInfo(req, "editor-user", []string{"editors"})
	req = withRole(req, rbac.RoleDeploymentManager)
	rec := httptest.NewRecorder()

	handler(rec, req)

	if rec.Result().StatusCode != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", rec.Result().StatusCode, http.StatusForbidden)
	}
}

func TestDeleteClusterHandler_NotFound(t *testing.T) {
	scheme := runtime.NewScheme()
	fakeDynamic := fake.NewSimpleDynamicClientWithCustomListKinds(scheme,
		map[schema.GroupVersionResource]string{
			clusterGVR: "ECKUIClusterList",
		},
	)
	fakeClientset := k8sfake.NewSimpleClientset()

	handler := DeleteClusterHandler(fakeDynamic, fakeClientset)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/clusters/nonexistent", nil)
	req = withMuxVars(req, map[string]string{"cluster": "nonexistent"})
	req = withUserInfo(req, "admin-user", []string{"admins"})
	req = withRole(req, rbac.RolePlatformAdmin)
	rec := httptest.NewRecorder()

	handler(rec, req)

	if rec.Result().StatusCode != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", rec.Result().StatusCode, http.StatusNotFound)
	}
}
