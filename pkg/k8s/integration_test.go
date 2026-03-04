//go:build integration

package k8s

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/watch"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

const (
	testNamespace    = "default"
	testResourceName = "integration-test-es"
	testResourceType = "elasticsearch"
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

// newIntegrationClient creates a Client connected to the local cluster.
// It skips the test if the cluster is unreachable.
func newIntegrationClient(t *testing.T) *Client {
	t.Helper()
	kc := kubeconfigPath(t)

	client, err := NewClient(kc)
	if err != nil {
		t.Skipf("skipping integration test: cannot create k8s client: %v", err)
	}

	if err := client.CheckHealth(); err != nil {
		t.Skipf("skipping integration test: cluster not reachable: %v", err)
	}

	return client
}

// newTestElasticsearch builds a minimal Elasticsearch CR for integration testing.
func newTestElasticsearch(name, namespace, version string) *unstructured.Unstructured {
	return &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "elasticsearch.k8s.elastic.co/v1",
			"kind":       "Elasticsearch",
			"metadata": map[string]interface{}{
				"name":      name,
				"namespace": namespace,
			},
			"spec": map[string]interface{}{
				"version": version,
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
		},
	}
}

// ensureTestResourceDeleted removes the test Elasticsearch resource if it exists.
// This is used in t.Cleanup to guarantee no test resources leak.
func ensureTestResourceDeleted(t *testing.T, client *Client) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	err := client.DeleteResource(ctx, testResourceType, testNamespace, testResourceName)
	if err != nil && !apierrors.IsNotFound(err) {
		t.Logf("cleanup: failed to delete test resource %s/%s: %v", testNamespace, testResourceName, err)
	}
}

// TestIntegration_NewClient verifies that a Kubernetes client can be created
// using the local kubeconfig and that the health check succeeds.
func TestIntegration_NewClient(t *testing.T) {
	kc := kubeconfigPath(t)

	client, err := NewClient(kc)
	if err != nil {
		t.Skipf("skipping: cannot create k8s client: %v", err)
	}

	if client.Clientset == nil {
		t.Fatal("expected non-nil Clientset")
	}
	if client.Dynamic == nil {
		t.Fatal("expected non-nil Dynamic client")
	}
	if client.Discovery == nil {
		t.Fatal("expected non-nil Discovery client")
	}

	if err := client.CheckHealth(); err != nil {
		t.Fatalf("CheckHealth() returned error: %v", err)
	}
}

// TestIntegration_ListResources verifies that listing Elasticsearch resources
// succeeds. The list may be empty if no Elasticsearch CRs exist.
func TestIntegration_ListResources(t *testing.T) {
	client := newIntegrationClient(t)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	list, err := client.ListResources(ctx, testResourceType, testNamespace)
	if err != nil {
		t.Fatalf("ListResources(%q, %q) returned error: %v", testResourceType, testNamespace, err)
	}

	if list == nil {
		t.Fatal("expected non-nil UnstructuredList")
	}

	t.Logf("found %d existing elasticsearch resources in namespace %q", len(list.Items), testNamespace)
}

// TestIntegration_CRUDElasticsearch exercises the full create-read-update-list-delete
// lifecycle for an Elasticsearch resource against the real cluster.
func TestIntegration_CRUDElasticsearch(t *testing.T) {
	client := newIntegrationClient(t)

	// Register cleanup first so the resource is removed even on test failure.
	t.Cleanup(func() { ensureTestResourceDeleted(t, client) })

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// --- CREATE ---
	esObj := newTestElasticsearch(testResourceName, testNamespace, "8.17.0")

	created, err := client.CreateResource(ctx, testResourceType, testNamespace, esObj)
	if err != nil {
		t.Fatalf("CreateResource() error: %v", err)
	}

	createdName := created.GetName()
	if createdName != testResourceName {
		t.Errorf("created resource name = %q, want %q", createdName, testResourceName)
	}

	createdNS := created.GetNamespace()
	if createdNS != testNamespace {
		t.Errorf("created resource namespace = %q, want %q", createdNS, testNamespace)
	}
	t.Logf("CREATE: successfully created %s/%s", createdNS, createdName)

	// --- GET ---
	got, err := client.GetResource(ctx, testResourceType, testNamespace, testResourceName)
	if err != nil {
		t.Fatalf("GetResource() error: %v", err)
	}

	gotVersion, found, err := unstructured.NestedString(got.Object, "spec", "version")
	if err != nil {
		t.Fatalf("failed to read spec.version: %v", err)
	}
	if !found {
		t.Fatal("spec.version not found in retrieved resource")
	}
	if gotVersion != "8.17.0" {
		t.Errorf("spec.version = %q, want %q", gotVersion, "8.17.0")
	}
	t.Logf("GET: verified spec.version = %q", gotVersion)

	// --- UPDATE ---
	// Update labels and annotations to verify the update round-trips correctly.
	// We avoid changing spec.version because the ECK admission webhook rejects
	// version downgrades, and upgrades trigger a rolling restart that is not
	// appropriate for a fast integration test.
	labels := got.GetLabels()
	if labels == nil {
		labels = make(map[string]string)
	}
	labels["eck-ui/integration-test"] = "true"
	labels["eck-ui/test-phase"] = "update"
	got.SetLabels(labels)

	annotations := got.GetAnnotations()
	if annotations == nil {
		annotations = make(map[string]string)
	}
	annotations["eck-ui/updated-at"] = time.Now().UTC().Format(time.RFC3339)
	got.SetAnnotations(annotations)

	updated, err := client.UpdateResource(ctx, testResourceType, testNamespace, got)
	if err != nil {
		t.Fatalf("UpdateResource() error: %v", err)
	}

	updatedLabels := updated.GetLabels()
	if updatedLabels["eck-ui/integration-test"] != "true" {
		t.Errorf("expected label eck-ui/integration-test=true, got labels: %v", updatedLabels)
	}
	if updatedLabels["eck-ui/test-phase"] != "update" {
		t.Errorf("expected label eck-ui/test-phase=update, got labels: %v", updatedLabels)
	}

	updatedAnnotations := updated.GetAnnotations()
	if updatedAnnotations["eck-ui/updated-at"] == "" {
		t.Errorf("expected annotation eck-ui/updated-at to be set, got annotations: %v", updatedAnnotations)
	}
	t.Logf("UPDATE: labels and annotations updated successfully")

	// --- LIST ---
	list, err := client.ListResources(ctx, testResourceType, testNamespace)
	if err != nil {
		t.Fatalf("ListResources() error: %v", err)
	}

	found = false
	for _, item := range list.Items {
		if item.GetName() == testResourceName && item.GetNamespace() == testNamespace {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("test resource %s/%s not found in list of %d resources",
			testNamespace, testResourceName, len(list.Items))
	}
	t.Logf("LIST: resource appears in list (%d total)", len(list.Items))

	// --- DELETE ---
	if err := client.DeleteResource(ctx, testResourceType, testNamespace, testResourceName); err != nil {
		t.Fatalf("DeleteResource() error: %v", err)
	}
	t.Log("DELETE: resource deleted")

	// --- VERIFY GONE ---
	// The resource may take a moment to fully disappear due to finalizers.
	// Poll briefly to confirm it is eventually not found.
	verifyCtx, verifyCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer verifyCancel()

	gone := false
	for !gone {
		_, err := client.GetResource(verifyCtx, testResourceType, testNamespace, testResourceName)
		if apierrors.IsNotFound(err) {
			gone = true
			break
		}
		if verifyCtx.Err() != nil {
			t.Fatalf("timed out waiting for resource to be deleted; last error: %v", err)
		}
		time.Sleep(500 * time.Millisecond)
	}
	t.Log("VERIFY: resource confirmed deleted (not found)")
}

// TestIntegration_GetEvents verifies that fetching events from the default
// namespace succeeds. The event list may be empty.
func TestIntegration_GetEvents(t *testing.T) {
	client := newIntegrationClient(t)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	events, err := client.GetEvents(ctx, testNamespace)
	if err != nil {
		t.Fatalf("GetEvents(%q) returned error: %v", testNamespace, err)
	}

	if events == nil {
		t.Fatal("expected non-nil UnstructuredList for events")
	}

	t.Logf("found %d events in namespace %q", len(events.Items), testNamespace)
}

// TestIntegration_WatchResources verifies that a watch stream correctly receives
// ADDED and DELETED events for an Elasticsearch resource.
func TestIntegration_WatchResources(t *testing.T) {
	client := newIntegrationClient(t)

	// Register cleanup to guarantee resource removal.
	t.Cleanup(func() { ensureTestResourceDeleted(t, client) })

	watchCtx, watchCancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer watchCancel()

	// Start the watch before creating the resource to capture the ADDED event.
	watcher, err := client.WatchResources(watchCtx, testResourceType, testNamespace)
	if err != nil {
		t.Fatalf("WatchResources() error: %v", err)
	}
	defer watcher.Stop()

	// --- CREATE ---
	createCtx, createCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer createCancel()

	esObj := newTestElasticsearch(testResourceName, testNamespace, "8.17.0")
	_, err = client.CreateResource(createCtx, testResourceType, testNamespace, esObj)
	if err != nil {
		t.Fatalf("CreateResource() error: %v", err)
	}
	t.Log("WATCH: created resource, waiting for ADDED event")

	// --- WAIT FOR ADDED EVENT ---
	addedReceived := false
	eventCh := watcher.ResultChan()

	for !addedReceived {
		select {
		case event, ok := <-eventCh:
			if !ok {
				t.Fatal("watch channel closed before receiving ADDED event")
			}
			obj, isUnstructured := event.Object.(*unstructured.Unstructured)
			if !isUnstructured {
				continue
			}
			if obj.GetName() == testResourceName && event.Type == watch.Added {
				addedReceived = true
				t.Logf("WATCH: received ADDED event for %s/%s", obj.GetNamespace(), obj.GetName())
			}
		case <-watchCtx.Done():
			t.Fatal("timed out waiting for ADDED watch event")
		}
	}

	// --- DELETE ---
	deleteCtx, deleteCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer deleteCancel()

	if err := client.DeleteResource(deleteCtx, testResourceType, testNamespace, testResourceName); err != nil {
		t.Fatalf("DeleteResource() error: %v", err)
	}
	t.Log("WATCH: deleted resource, waiting for DELETED or MODIFIED event")

	// --- WAIT FOR DELETED OR MODIFIED EVENT ---
	// Kubernetes may send a MODIFIED event (with deletionTimestamp) before the
	// actual DELETED event due to finalizer processing.
	deleteEventReceived := false
	for !deleteEventReceived {
		select {
		case event, ok := <-eventCh:
			if !ok {
				t.Fatal("watch channel closed before receiving delete-related event")
			}
			obj, isUnstructured := event.Object.(*unstructured.Unstructured)
			if !isUnstructured {
				continue
			}
			if obj.GetName() != testResourceName {
				continue
			}
			if event.Type == watch.Deleted || event.Type == watch.Modified {
				deleteEventReceived = true
				t.Logf("WATCH: received %s event for %s/%s", event.Type, obj.GetNamespace(), obj.GetName())
			}
		case <-watchCtx.Done():
			t.Fatal("timed out waiting for DELETED/MODIFIED watch event")
		}
	}
}
