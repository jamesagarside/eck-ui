//go:build e2e

package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/gorilla/mux"
	"github.com/jamesagarside/eck-ui/pkg/k8s"
	"github.com/jamesagarside/eck-ui/pkg/middleware"
	"github.com/jamesagarside/eck-ui/pkg/resources"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

const (
	e2eNamespace    = "default"
	e2eResourceName = "e2e-test-es"
	e2eResourceType = "elasticsearch"
)

// kubeconfigPath returns the kubeconfig path from the KUBECONFIG environment
// variable, falling back to ~/.kube/config.
func kubeconfigPath(t *testing.T) string {
	t.Helper()
	if kc := os.Getenv("KUBECONFIG"); kc != "" {
		return kc
	}
	home, err := os.UserHomeDir()
	if err != nil {
		t.Fatalf("failed to determine home directory: %v", err)
	}
	return filepath.Join(home, ".kube", "config")
}

// newE2EK8sClient creates a K8s client connected to the local cluster
// (docker-desktop context). Skips the test if the cluster is unreachable.
func newE2EK8sClient(t *testing.T) *k8s.Client {
	t.Helper()
	kc := kubeconfigPath(t)

	client, err := k8s.NewClient(kc)
	if err != nil {
		t.Skipf("skipping e2e test: cannot create k8s client: %v", err)
	}

	if err := client.CheckHealth(); err != nil {
		t.Skipf("skipping e2e test: cluster not reachable: %v", err)
	}

	return client
}

// fakeAuthMiddleware injects a fake admin user into the request context,
// bypassing real authentication for E2E testing.
func fakeAuthMiddleware() mux.MiddlewareFunc {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userInfo := &middleware.ContextUserInfo{
				Username: "e2e-test-user",
				UID:      "e2e-uid-0001",
				Groups:   []string{"system:masters", "admin"},
			}
			ctx := context.WithValue(r.Context(), contextKeyUserInfo, userInfo)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// contextKeyType is an unexported type for context keys to avoid collisions.
type contextKeyType string

// contextKeyUserInfo matches the key used in middleware.Auth so that
// middleware.UserInfoFromContext can retrieve it.
const contextKeyUserInfo contextKeyType = "userInfo"

// newE2EServer creates an httptest.Server wired to the real K8s client with
// fake auth middleware. It registers the same routes as the production server
// (health, readyz, and resource CRUD) minus audit logging and real auth.
func newE2EServer(t *testing.T, k8sClient *k8s.Client) *httptest.Server {
	t.Helper()

	resourceHandler := resources.NewHandler(k8sClient)

	r := mux.NewRouter()

	// Health endpoints (unauthenticated, same as production).
	r.HandleFunc("/healthz", HealthzHandler).Methods("GET")
	r.HandleFunc("/readyz", ReadyzHandler(k8sClient)).Methods("GET")

	// API routes with fake auth (bypasses real token validation + RBAC).
	api := r.PathPrefix("/api/v1").Subrouter()
	api.Use(fakeAuthMiddleware())

	// Resource CRUD endpoints for all ECK resource types.
	resourceTypes := []string{
		"elasticsearch", "kibana", "apmserver", "beat", "agent",
		"logstash", "enterprisesearch", "elasticmapsserver",
		"elasticsearchautoscaler", "stackconfigpolicy",
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

// ensureE2EResourceDeleted removes the test resource using the K8s client
// directly, guaranteeing cleanup even if the API server is broken.
func ensureE2EResourceDeleted(t *testing.T, client *k8s.Client) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	err := client.DeleteResource(ctx, e2eResourceType, e2eNamespace, e2eResourceName)
	if err != nil && !apierrors.IsNotFound(err) {
		t.Logf("cleanup: failed to delete e2e test resource %s/%s: %v", e2eNamespace, e2eResourceName, err)
	}
}

// e2eElasticsearchBody returns the JSON body for creating the test Elasticsearch resource.
func e2eElasticsearchBody() map[string]interface{} {
	return map[string]interface{}{
		"apiVersion": "elasticsearch.k8s.elastic.co/v1",
		"kind":       "Elasticsearch",
		"metadata": map[string]interface{}{
			"name":      e2eResourceName,
			"namespace": e2eNamespace,
		},
		"spec": map[string]interface{}{
			"version": "8.17.0",
			"nodeSets": []interface{}{
				map[string]interface{}{
					"name":  "default",
					"count": int64(1),
					"config": map[string]interface{}{
						"node.store.allow_mmap": false,
					},
					"podTemplate": map[string]interface{}{
						"spec": map[string]interface{}{
							"containers": []interface{}{
								map[string]interface{}{
									"name": "elasticsearch",
									"resources": map[string]interface{}{
										"limits": map[string]interface{}{
											"memory": "1Gi",
										},
										"requests": map[string]interface{}{
											"memory": "1Gi",
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}
}

// TestE2E_HealthEndpoints verifies that /healthz and /readyz return 200 when
// connected to a live Kubernetes cluster.
func TestE2E_HealthEndpoints(t *testing.T) {
	k8sClient := newE2EK8sClient(t)
	srv := newE2EServer(t, k8sClient)

	t.Run("GET /healthz returns 200", func(t *testing.T) {
		resp, err := http.Get(srv.URL + "/healthz")
		if err != nil {
			t.Fatalf("GET /healthz failed: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			t.Fatalf("GET /healthz status = %d, want %d; body: %s", resp.StatusCode, http.StatusOK, body)
		}

		var result map[string]string
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			t.Fatalf("failed to decode /healthz response: %v", err)
		}
		if result["status"] != "ok" {
			t.Errorf("healthz status = %q, want %q", result["status"], "ok")
		}
	})

	t.Run("GET /readyz returns 200", func(t *testing.T) {
		resp, err := http.Get(srv.URL + "/readyz")
		if err != nil {
			t.Fatalf("GET /readyz failed: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			t.Fatalf("GET /readyz status = %d, want %d; body: %s", resp.StatusCode, http.StatusOK, body)
		}

		var result map[string]string
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			t.Fatalf("failed to decode /readyz response: %v", err)
		}
		if result["status"] != "ready" {
			t.Errorf("readyz status = %q, want %q", result["status"], "ready")
		}
	})
}

// TestE2E_ElasticsearchLifecycle exercises the full create->list->get->delete
// lifecycle for an Elasticsearch resource through the REST API, backed by a
// real Kubernetes cluster.
func TestE2E_ElasticsearchLifecycle(t *testing.T) {
	k8sClient := newE2EK8sClient(t)
	srv := newE2EServer(t, k8sClient)

	// Register cleanup using the K8s client directly so the resource is
	// removed even if the HTTP API is broken.
	t.Cleanup(func() { ensureE2EResourceDeleted(t, k8sClient) })

	httpClient := srv.Client()

	// ---- STEP 1: CREATE ----
	t.Log("STEP 1: POST /api/v1/elasticsearch/default - creating e2e-test-es")

	createBody, err := json.Marshal(e2eElasticsearchBody())
	if err != nil {
		t.Fatalf("failed to marshal create body: %v", err)
	}

	createResp, err := httpClient.Post(
		srv.URL+"/api/v1/elasticsearch/"+e2eNamespace,
		"application/json",
		bytes.NewReader(createBody),
	)
	if err != nil {
		t.Fatalf("POST create failed: %v", err)
	}
	defer createResp.Body.Close()

	createRespBody, _ := io.ReadAll(createResp.Body)
	if createResp.StatusCode != http.StatusCreated {
		t.Fatalf("POST create status = %d, want %d; body: %s",
			createResp.StatusCode, http.StatusCreated, createRespBody)
	}

	var created map[string]interface{}
	if err := json.Unmarshal(createRespBody, &created); err != nil {
		t.Fatalf("failed to decode create response: %v", err)
	}

	metadata, ok := created["metadata"].(map[string]interface{})
	if !ok {
		t.Fatalf("response missing metadata; body: %s", createRespBody)
	}
	if metadata["name"] != e2eResourceName {
		t.Errorf("created name = %v, want %q", metadata["name"], e2eResourceName)
	}
	if metadata["namespace"] != e2eNamespace {
		t.Errorf("created namespace = %v, want %q", metadata["namespace"], e2eNamespace)
	}
	t.Logf("CREATE: resource %s/%s created successfully", e2eNamespace, e2eResourceName)

	// ---- STEP 2: LIST ----
	t.Log("STEP 2: GET /api/v1/elasticsearch - listing all elasticsearch resources")

	listResp, err := httpClient.Get(srv.URL + "/api/v1/elasticsearch")
	if err != nil {
		t.Fatalf("GET list failed: %v", err)
	}
	defer listResp.Body.Close()

	listRespBody, _ := io.ReadAll(listResp.Body)
	if listResp.StatusCode != http.StatusOK {
		t.Fatalf("GET list status = %d, want %d; body: %s",
			listResp.StatusCode, http.StatusOK, listRespBody)
	}

	var listResult map[string]interface{}
	if err := json.Unmarshal(listRespBody, &listResult); err != nil {
		t.Fatalf("failed to decode list response: %v", err)
	}

	items, ok := listResult["items"].([]interface{})
	if !ok {
		t.Fatalf("list response missing items array; body: %s", listRespBody)
	}

	found := false
	for _, item := range items {
		itemMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		itemMeta, ok := itemMap["metadata"].(map[string]interface{})
		if !ok {
			continue
		}
		if itemMeta["name"] == e2eResourceName && itemMeta["namespace"] == e2eNamespace {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("LIST: resource %s/%s not found among %d items",
			e2eNamespace, e2eResourceName, len(items))
	} else {
		t.Logf("LIST: resource %s/%s appears in list (%d total items)",
			e2eNamespace, e2eResourceName, len(items))
	}

	// ---- STEP 3: GET single resource ----
	t.Log("STEP 3: GET /api/v1/elasticsearch/default/e2e-test-es - getting single resource")

	getResp, err := httpClient.Get(
		srv.URL + "/api/v1/elasticsearch/" + e2eNamespace + "/" + e2eResourceName,
	)
	if err != nil {
		t.Fatalf("GET single failed: %v", err)
	}
	defer getResp.Body.Close()

	getRespBody, _ := io.ReadAll(getResp.Body)
	if getResp.StatusCode != http.StatusOK {
		t.Fatalf("GET single status = %d, want %d; body: %s",
			getResp.StatusCode, http.StatusOK, getRespBody)
	}

	var getResult map[string]interface{}
	if err := json.Unmarshal(getRespBody, &getResult); err != nil {
		t.Fatalf("failed to decode get response: %v", err)
	}

	getMeta, ok := getResult["metadata"].(map[string]interface{})
	if !ok {
		t.Fatalf("get response missing metadata; body: %s", getRespBody)
	}
	if getMeta["name"] != e2eResourceName {
		t.Errorf("GET name = %v, want %q", getMeta["name"], e2eResourceName)
	}

	spec, ok := getResult["spec"].(map[string]interface{})
	if !ok {
		t.Fatalf("get response missing spec; body: %s", getRespBody)
	}
	if spec["version"] != "8.17.0" {
		t.Errorf("GET spec.version = %v, want %q", spec["version"], "8.17.0")
	}
	t.Logf("GET: resource %s/%s retrieved, spec.version=%v", e2eNamespace, e2eResourceName, spec["version"])

	// ---- STEP 4: DELETE ----
	t.Log("STEP 4: DELETE /api/v1/elasticsearch/default/e2e-test-es - deleting resource")

	deleteReq, err := http.NewRequest(
		http.MethodDelete,
		srv.URL+"/api/v1/elasticsearch/"+e2eNamespace+"/"+e2eResourceName,
		nil,
	)
	if err != nil {
		t.Fatalf("failed to create DELETE request: %v", err)
	}

	deleteResp, err := httpClient.Do(deleteReq)
	if err != nil {
		t.Fatalf("DELETE failed: %v", err)
	}
	defer deleteResp.Body.Close()

	deleteRespBody, _ := io.ReadAll(deleteResp.Body)
	if deleteResp.StatusCode != http.StatusOK {
		t.Fatalf("DELETE status = %d, want %d; body: %s",
			deleteResp.StatusCode, http.StatusOK, deleteRespBody)
	}

	var deleteResult map[string]string
	if err := json.Unmarshal(deleteRespBody, &deleteResult); err != nil {
		t.Fatalf("failed to decode delete response: %v", err)
	}
	if deleteResult["status"] != "deleted" {
		t.Errorf("DELETE status = %q, want %q", deleteResult["status"], "deleted")
	}
	t.Logf("DELETE: resource %s/%s delete accepted", e2eNamespace, e2eResourceName)

	// ---- STEP 5: VERIFY 404 ----
	t.Log("STEP 5: GET /api/v1/elasticsearch/default/e2e-test-es - verifying 404 after delete")

	// The resource may take a moment to fully disappear due to finalizers.
	// Poll briefly to confirm it is eventually not found via the API.
	verifyCtx, verifyCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer verifyCancel()

	gone := false
	for !gone {
		verifyResp, err := httpClient.Get(
			srv.URL + "/api/v1/elasticsearch/" + e2eNamespace + "/" + e2eResourceName,
		)
		if err != nil {
			t.Fatalf("GET verify failed: %v", err)
		}

		verifyBody, _ := io.ReadAll(verifyResp.Body)
		verifyResp.Body.Close()

		if verifyResp.StatusCode == http.StatusNotFound {
			gone = true
			t.Logf("VERIFY: resource confirmed deleted (HTTP 404)")
			break
		}

		if verifyCtx.Err() != nil {
			t.Fatalf("timed out waiting for resource to return 404; last status=%d, body: %s",
				verifyResp.StatusCode, verifyBody)
		}

		time.Sleep(500 * time.Millisecond)
	}
}
