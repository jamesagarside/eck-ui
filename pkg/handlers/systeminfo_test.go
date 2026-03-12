package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jamesagarside/eck-ui/pkg/k8s"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic/fake"
	k8sfake "k8s.io/client-go/kubernetes/fake"
)

// crdListGVR is the GVR for CRDs, used to register the list kind with the
// fake dynamic client so that List calls do not panic.
var crdListGVR = schema.GroupVersionResource{
	Group:    "apiextensions.k8s.io",
	Version:  "v1",
	Resource: "customresourcedefinitions",
}

func newSystemInfoClient(objects ...runtime.Object) *k8s.Client {
	fakeClientset := k8sfake.NewSimpleClientset(objects...)

	scheme := runtime.NewScheme()
	fakeDynamic := fake.NewSimpleDynamicClientWithCustomListKinds(scheme,
		map[schema.GroupVersionResource]string{
			crdListGVR: "CustomResourceDefinitionList",
		},
	)

	return &k8s.Client{
		Clientset: fakeClientset,
		Dynamic:   fakeDynamic,
	}
}

func TestSystemInfoHandler_ReturnsOK(t *testing.T) {
	client := newSystemInfoClient()
	handler := SystemInfoHandler(client)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/system-info", nil)
	rec := httptest.NewRecorder()

	handler(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", res.StatusCode, http.StatusOK)
	}

	var body SystemInfoResponse
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
}

func TestSystemInfoHandler_ContentType(t *testing.T) {
	client := newSystemInfoClient()
	handler := SystemInfoHandler(client)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/system-info", nil)
	rec := httptest.NewRecorder()

	handler(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	ct := res.Header.Get("Content-Type")
	wantCT := "application/json; charset=utf-8"
	if ct != wantCT {
		t.Errorf("Content-Type = %q, want %q", ct, wantCT)
	}
}

func TestSystemInfoHandler_UIVersionMatchesPackageVar(t *testing.T) {
	client := newSystemInfoClient()
	handler := SystemInfoHandler(client)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/system-info", nil)
	rec := httptest.NewRecorder()

	handler(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	var body SystemInfoResponse
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	if body.UIVersion != Version {
		t.Errorf("uiVersion = %q, want %q", body.UIVersion, Version)
	}
}

func TestSystemInfoHandler_K8sVersionPopulated(t *testing.T) {
	// The fake clientset's discovery client returns a default server version.
	client := newSystemInfoClient()
	handler := SystemInfoHandler(client)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/system-info", nil)
	rec := httptest.NewRecorder()

	handler(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	var body SystemInfoResponse
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	// The fake discovery client returns a non-empty GitVersion.
	if body.K8sVersion == "" {
		t.Error("k8sVersion is empty, expected a value from fake discovery")
	}
}

func TestSystemInfoHandler_CRDVersionsMapPresent(t *testing.T) {
	client := newSystemInfoClient()
	handler := SystemInfoHandler(client)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/system-info", nil)
	rec := httptest.NewRecorder()

	handler(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	var body SystemInfoResponse
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	if body.CRDVersions == nil {
		t.Error("crdVersions is nil, expected an initialized map")
	}
}

func TestSystemInfoHandler_OperatorVersionFromDeployment(t *testing.T) {
	// Create a fake elastic-operator Deployment with a "manager" container
	// so the handler can extract the operator image version.
	deploy := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "elastic-operator",
			Namespace: "elastic-system",
		},
		Spec: appsv1.DeploymentSpec{
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{"app": "elastic-operator"},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{"app": "elastic-operator"},
				},
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{
						{
							Name:  "manager",
							Image: "docker.elastic.co/eck/eck-operator:2.14.0",
						},
					},
				},
			},
		},
	}

	client := newSystemInfoClient(deploy)
	handler := SystemInfoHandler(client)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/system-info", nil)
	rec := httptest.NewRecorder()

	handler(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	var body SystemInfoResponse
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	wantImage := "docker.elastic.co/eck/eck-operator:2.14.0"
	if body.OperatorVersion != wantImage {
		t.Errorf("operatorVersion = %q, want %q", body.OperatorVersion, wantImage)
	}
}

func TestSystemInfoHandler_OperatorVersionFallbackToFirstContainer(t *testing.T) {
	// When the Deployment has no container named "manager", the handler
	// should fall back to the first container's image.
	deploy := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "elastic-operator",
			Namespace: "elastic-system",
		},
		Spec: appsv1.DeploymentSpec{
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{"app": "elastic-operator"},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{"app": "elastic-operator"},
				},
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{
						{
							Name:  "operator",
							Image: "docker.elastic.co/eck/eck-operator:2.13.0",
						},
					},
				},
			},
		},
	}

	client := newSystemInfoClient(deploy)
	handler := SystemInfoHandler(client)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/system-info", nil)
	rec := httptest.NewRecorder()

	handler(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	var body SystemInfoResponse
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	wantImage := "docker.elastic.co/eck/eck-operator:2.13.0"
	if body.OperatorVersion != wantImage {
		t.Errorf("operatorVersion = %q, want %q", body.OperatorVersion, wantImage)
	}
}

func TestSystemInfoHandler_WithECKCRDs(t *testing.T) {
	// Set up a fake dynamic client that has an ECK CRD so we can verify
	// the handler populates CRDVersions from the dynamic client.
	scheme := runtime.NewScheme()

	esCRD := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "apiextensions.k8s.io/v1",
			"kind":       "CustomResourceDefinition",
			"metadata": map[string]interface{}{
				"name": "elasticsearches.elasticsearch.k8s.elastic.co",
			},
			"spec": map[string]interface{}{
				"group": "elasticsearch.k8s.elastic.co",
				"versions": []interface{}{
					map[string]interface{}{
						"name":   "v1",
						"served": true,
					},
				},
			},
		},
	}

	gvr := schema.GroupVersionResource{
		Group:    "apiextensions.k8s.io",
		Version:  "v1",
		Resource: "customresourcedefinitions",
	}

	fakeDynamic := fake.NewSimpleDynamicClientWithCustomListKinds(scheme,
		map[schema.GroupVersionResource]string{
			gvr: "CustomResourceDefinitionList",
		},
		esCRD,
	)

	fakeClientset := k8sfake.NewSimpleClientset()
	client := &k8s.Client{
		Clientset: fakeClientset,
		Dynamic:   fakeDynamic,
	}

	handler := SystemInfoHandler(client)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/system-info", nil)
	rec := httptest.NewRecorder()

	handler(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", res.StatusCode, http.StatusOK)
	}

	var body SystemInfoResponse
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	crdName := "elasticsearches.elasticsearch.k8s.elastic.co"
	version, ok := body.CRDVersions[crdName]
	if !ok {
		t.Fatalf("crdVersions missing key %q", crdName)
	}
	if version != "v1" {
		t.Errorf("crdVersions[%q] = %q, want %q", crdName, version, "v1")
	}
}

func TestSystemInfoHandler_ResponseStructure(t *testing.T) {
	// Verify the full JSON structure has all expected top-level keys.
	client := newSystemInfoClient()
	handler := SystemInfoHandler(client)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/system-info", nil)
	rec := httptest.NewRecorder()

	handler(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	var raw map[string]interface{}
	if err := json.NewDecoder(res.Body).Decode(&raw); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	requiredKeys := []string{"uiVersion", "k8sVersion", "operatorVersion", "crdVersions"}
	for _, key := range requiredKeys {
		if _, ok := raw[key]; !ok {
			t.Errorf("response missing required key %q", key)
		}
	}
}
