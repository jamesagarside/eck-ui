package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/jamesagarside/eck-ui/pkg/auth"
	"github.com/jamesagarside/eck-ui/pkg/clusters"
	"github.com/jamesagarside/eck-ui/pkg/rbac"
)

func withUserInfo(ctx context.Context, username string, groups []string) context.Context {
	return context.WithValue(ctx, userInfoKey, &ContextUserInfo{
		Username: username,
		Groups:   groups,
	})
}

func withPlatformRole(ctx context.Context, role rbac.PlatformRole) context.Context {
	return context.WithValue(ctx, platformRoleKey, role)
}

func TestIsGroupAllowed_EmptyAllowedGroups(t *testing.T) {
	if !isGroupAllowed([]string{"team-a"}, []string{}) {
		t.Error("expected unrestricted access when allowedGroups is empty")
	}
}

func TestIsGroupAllowed_Nil(t *testing.T) {
	if !isGroupAllowed([]string{"team-a"}, nil) {
		t.Error("expected unrestricted access when allowedGroups is nil")
	}
}

func TestIsGroupAllowed_Match(t *testing.T) {
	if !isGroupAllowed([]string{"team-a", "team-b"}, []string{"team-b"}) {
		t.Error("expected access when user group matches")
	}
}

func TestIsGroupAllowed_NoMatch(t *testing.T) {
	if isGroupAllowed([]string{"team-a"}, []string{"team-b", "team-c"}) {
		t.Error("expected no access when no group matches")
	}
}

func TestIsGroupAllowed_EmptyUserGroups(t *testing.T) {
	if isGroupAllowed([]string{}, []string{"team-b"}) {
		t.Error("expected no access when user has no groups")
	}
}

func TestClusterContext_LocalAlias(t *testing.T) {
	var capturedClusterID string
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedClusterID = clusters.ClusterIDFromContext(r.Context())
		w.WriteHeader(http.StatusOK)
	})

	manager := clusters.NewClusterManager(nil, nil)
	mw := ClusterContext(manager, nil)

	router := mux.NewRouter()
	router.Handle("/api/v1/clusters/{cluster}/elasticsearch", mw(inner))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/clusters/local/elasticsearch", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}
	if capturedClusterID != "local" {
		t.Errorf("expected cluster ID 'local', got %q", capturedClusterID)
	}
}

func TestClusterContext_EmptyCluster(t *testing.T) {
	var capturedClusterID string
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedClusterID = clusters.ClusterIDFromContext(r.Context())
		w.WriteHeader(http.StatusOK)
	})

	manager := clusters.NewClusterManager(nil, nil)
	mw := ClusterContext(manager, nil)

	router := mux.NewRouter()
	router.Handle("/api/v1/test", mw(inner))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}
	if capturedClusterID != "local" {
		t.Errorf("expected cluster ID 'local', got %q", capturedClusterID)
	}
}

func TestClusterContext_UnknownCluster(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not have been called")
	})

	manager := clusters.NewClusterManager(nil, nil)
	mw := ClusterContext(manager, nil)

	router := mux.NewRouter()
	router.Handle("/api/v1/clusters/{cluster}/elasticsearch", mw(inner))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/clusters/nonexistent/elasticsearch", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rec.Code)
	}

	var body map[string]interface{}
	json.NewDecoder(rec.Body).Decode(&body)
	if body["reason"] != "NotFound" {
		t.Errorf("expected reason 'NotFound', got %v", body["reason"])
	}
}

func TestClusterContext_StaleInfoContextHelpers(t *testing.T) {
	ctx := context.Background()
	staleInfo := &clusters.StaleInfo{IsStale: true, StaleSince: "2026-03-14T12:00:00Z"}
	ctx = clusters.WithStaleInfo(ctx, staleInfo)

	retrieved := clusters.StaleInfoFromContext(ctx)
	if retrieved == nil {
		t.Fatal("expected stale info in context")
	}
	if !retrieved.IsStale {
		t.Error("expected IsStale=true")
	}
	if retrieved.StaleSince != "2026-03-14T12:00:00Z" {
		t.Errorf("expected StaleSince, got %q", retrieved.StaleSince)
	}
}

func TestClusterContext_ClusterIDContextHelpers(t *testing.T) {
	ctx := context.Background()
	ctx = clusters.WithClusterID(ctx, "test-cluster")

	id := clusters.ClusterIDFromContext(ctx)
	if id != "test-cluster" {
		t.Errorf("expected cluster ID 'test-cluster', got %q", id)
	}
}

func TestClusterContext_NoClientInEmptyContext(t *testing.T) {
	ctx := context.Background()
	_, ok := clusters.ClientFromContext(ctx)
	if ok {
		t.Error("expected no client in empty context")
	}
}

func TestClusterContext_NoStaleInfoInEmptyContext(t *testing.T) {
	ctx := context.Background()
	info := clusters.StaleInfoFromContext(ctx)
	if info != nil {
		t.Error("expected no stale info in empty context")
	}
}

func TestWithUserInfoAndRetrieval(t *testing.T) {
	ctx := withUserInfo(context.Background(), "alice", []string{"team-a", "team-b"})
	info := UserInfoFromContext(ctx)
	if info == nil {
		t.Fatal("expected user info in context")
	}
	if info.Username != "alice" {
		t.Errorf("expected username 'alice', got %q", info.Username)
	}
	if len(info.Groups) != 2 {
		t.Fatalf("expected 2 groups, got %d", len(info.Groups))
	}
}

func TestWithPlatformRoleAndRetrieval(t *testing.T) {
	ctx := withPlatformRole(context.Background(), rbac.RolePlatformAdmin)
	role := RoleFromContext(ctx)
	if role != "admin" {
		t.Errorf("expected role 'admin', got %q", role)
	}
}

func TestRoleFromContext_Viewer(t *testing.T) {
	ctx := withPlatformRole(context.Background(), rbac.RolePlatformViewer)
	role := RoleFromContext(ctx)
	if role != "viewer" {
		t.Errorf("expected role 'viewer', got %q", role)
	}
}

func TestRoleFromContext_Editor(t *testing.T) {
	ctx := withPlatformRole(context.Background(), rbac.RoleDeploymentManager)
	role := RoleFromContext(ctx)
	if role != "editor" {
		t.Errorf("expected role 'editor', got %q", role)
	}
}

func TestUserInfoConversion(t *testing.T) {
	ctxInfo := &ContextUserInfo{
		Username: "bob",
		UID:      "uid-123",
		Groups:   []string{"dev"},
	}

	authInfo := &auth.UserInfo{
		Username: ctxInfo.Username,
		UID:      ctxInfo.UID,
		Groups:   ctxInfo.Groups,
	}

	if authInfo.Username != "bob" {
		t.Errorf("expected username 'bob', got %q", authInfo.Username)
	}
	if authInfo.UID != "uid-123" {
		t.Errorf("expected UID 'uid-123', got %q", authInfo.UID)
	}
}
