package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jamesagarside/eck-ui/pkg/k8s"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

const testNamespace = "elastic-system"

func TestDeploymentTemplatesHandler_BuiltInDefaults(t *testing.T) {
	// Create a fake clientset with no ConfigMaps. The handler should fall
	// back to the built-in defaults when the ConfigMap does not exist.
	fakeClientset := fake.NewSimpleClientset()
	client := &k8s.Client{
		Clientset: fakeClientset,
	}

	handler := DeploymentTemplatesHandler(client, testNamespace)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/deployment-templates", nil)
	rec := httptest.NewRecorder()

	handler(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", res.StatusCode, http.StatusOK)
	}

	ct := res.Header.Get("Content-Type")
	wantCT := "application/json; charset=utf-8"
	if ct != wantCT {
		t.Errorf("Content-Type = %q, want %q", ct, wantCT)
	}

	var body TemplatesResponse
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	if body.Source != "built-in" {
		t.Errorf("source = %q, want %q", body.Source, "built-in")
	}

	if len(body.Templates) != 3 {
		t.Fatalf("template count = %d, want 3", len(body.Templates))
	}

	// Verify each built-in template name in order.
	wantNames := []string{"dev", "production", "observability"}
	for i, want := range wantNames {
		if body.Templates[i].Name != want {
			t.Errorf("templates[%d].name = %q, want %q", i, body.Templates[i].Name, want)
		}
	}

	// Verify labels are populated.
	wantLabels := []string{"Development", "Production", "Observability"}
	for i, want := range wantLabels {
		if body.Templates[i].Label != want {
			t.Errorf("templates[%d].label = %q, want %q", i, body.Templates[i].Label, want)
		}
	}

	// Verify each template has a non-empty description.
	for i, tmpl := range body.Templates {
		if tmpl.Description == "" {
			t.Errorf("templates[%d].description is empty", i)
		}
	}

	// Verify each template has a non-empty icon.
	for i, tmpl := range body.Templates {
		if tmpl.Icon == "" {
			t.Errorf("templates[%d].icon is empty", i)
		}
	}

	// Verify each template has a non-empty intent (valid JSON).
	for i, tmpl := range body.Templates {
		if len(tmpl.Intent) == 0 {
			t.Errorf("templates[%d].intent is empty", i)
		}
		var intentCheck map[string]interface{}
		if err := json.Unmarshal(tmpl.Intent, &intentCheck); err != nil {
			t.Errorf("templates[%d].intent is not valid JSON: %v", i, err)
		}
	}
}

func TestDeploymentTemplatesHandler_CustomFromConfigMap(t *testing.T) {
	// Build custom templates JSON to store in the ConfigMap.
	customTemplates := []DeploymentTemplate{
		{
			Name:        "custom-small",
			Label:       "Custom Small",
			Description: "A small custom deployment for testing",
			Icon:        "node",
			Intent:      json.RawMessage(`{"version":"8.17.0","components":{"elasticsearch":{"enabled":true}}}`),
		},
		{
			Name:        "custom-large",
			Label:       "Custom Large",
			Description: "A large custom deployment for production",
			Icon:        "launch",
			Intent:      json.RawMessage(`{"version":"9.0.0","components":{"elasticsearch":{"enabled":true},"kibana":{"enabled":true}}}`),
		},
	}

	templatesJSON, err := json.Marshal(customTemplates)
	if err != nil {
		t.Fatalf("failed to marshal custom templates: %v", err)
	}

	// Create the ConfigMap that the handler expects.
	cm := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      templatesConfigMapName,
			Namespace: testNamespace,
		},
		Data: map[string]string{
			"templates.json": string(templatesJSON),
		},
	}

	fakeClientset := fake.NewSimpleClientset(cm)
	client := &k8s.Client{
		Clientset: fakeClientset,
	}

	handler := DeploymentTemplatesHandler(client, testNamespace)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/deployment-templates", nil)
	rec := httptest.NewRecorder()

	handler(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", res.StatusCode, http.StatusOK)
	}

	ct := res.Header.Get("Content-Type")
	wantCT := "application/json; charset=utf-8"
	if ct != wantCT {
		t.Errorf("Content-Type = %q, want %q", ct, wantCT)
	}

	var body TemplatesResponse
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	if body.Source != "configmap" {
		t.Errorf("source = %q, want %q", body.Source, "configmap")
	}

	if len(body.Templates) != 2 {
		t.Fatalf("template count = %d, want 2", len(body.Templates))
	}

	// Verify custom template names.
	if body.Templates[0].Name != "custom-small" {
		t.Errorf("templates[0].name = %q, want %q", body.Templates[0].Name, "custom-small")
	}
	if body.Templates[1].Name != "custom-large" {
		t.Errorf("templates[1].name = %q, want %q", body.Templates[1].Name, "custom-large")
	}

	// Verify labels.
	if body.Templates[0].Label != "Custom Small" {
		t.Errorf("templates[0].label = %q, want %q", body.Templates[0].Label, "Custom Small")
	}
	if body.Templates[1].Label != "Custom Large" {
		t.Errorf("templates[1].label = %q, want %q", body.Templates[1].Label, "Custom Large")
	}

	// Verify descriptions.
	if body.Templates[0].Description != "A small custom deployment for testing" {
		t.Errorf("templates[0].description = %q, want %q",
			body.Templates[0].Description, "A small custom deployment for testing")
	}
	if body.Templates[1].Description != "A large custom deployment for production" {
		t.Errorf("templates[1].description = %q, want %q",
			body.Templates[1].Description, "A large custom deployment for production")
	}

	// Verify intent JSON is preserved correctly.
	for i, tmpl := range body.Templates {
		var intentCheck map[string]interface{}
		if err := json.Unmarshal(tmpl.Intent, &intentCheck); err != nil {
			t.Errorf("templates[%d].intent is not valid JSON: %v", i, err)
		}
	}
}

func TestDeploymentTemplatesHandler_InvalidConfigMapJSON(t *testing.T) {
	// When the ConfigMap exists but contains invalid JSON in the
	// templates.json key, the handler should fall back to built-in defaults.
	cm := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      templatesConfigMapName,
			Namespace: testNamespace,
		},
		Data: map[string]string{
			"templates.json": `this is not valid json`,
		},
	}

	fakeClientset := fake.NewSimpleClientset(cm)
	client := &k8s.Client{
		Clientset: fakeClientset,
	}

	handler := DeploymentTemplatesHandler(client, testNamespace)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/deployment-templates", nil)
	rec := httptest.NewRecorder()

	handler(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", res.StatusCode, http.StatusOK)
	}

	var body TemplatesResponse
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	if body.Source != "built-in" {
		t.Errorf("source = %q, want %q (expected fallback on invalid JSON)", body.Source, "built-in")
	}

	if len(body.Templates) != 3 {
		t.Errorf("template count = %d, want 3 (built-in defaults)", len(body.Templates))
	}
}

func TestDeploymentTemplatesHandler_EmptyTemplatesArray(t *testing.T) {
	// When the ConfigMap exists but the templates array is empty, the
	// handler should fall back to built-in defaults because the condition
	// len(templates) > 0 is not met.
	cm := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      templatesConfigMapName,
			Namespace: testNamespace,
		},
		Data: map[string]string{
			"templates.json": `[]`,
		},
	}

	fakeClientset := fake.NewSimpleClientset(cm)
	client := &k8s.Client{
		Clientset: fakeClientset,
	}

	handler := DeploymentTemplatesHandler(client, testNamespace)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/deployment-templates", nil)
	rec := httptest.NewRecorder()

	handler(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", res.StatusCode, http.StatusOK)
	}

	var body TemplatesResponse
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	if body.Source != "built-in" {
		t.Errorf("source = %q, want %q (expected fallback on empty array)", body.Source, "built-in")
	}

	if len(body.Templates) != 3 {
		t.Errorf("template count = %d, want 3 (built-in defaults)", len(body.Templates))
	}
}

func TestDeploymentTemplatesHandler_MissingTemplatesKey(t *testing.T) {
	// When the ConfigMap exists but does not have a "templates.json" data
	// key, the handler should fall back to built-in defaults.
	cm := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      templatesConfigMapName,
			Namespace: testNamespace,
		},
		Data: map[string]string{
			"other-key": `[{"name":"ignored"}]`,
		},
	}

	fakeClientset := fake.NewSimpleClientset(cm)
	client := &k8s.Client{
		Clientset: fakeClientset,
	}

	handler := DeploymentTemplatesHandler(client, testNamespace)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/deployment-templates", nil)
	rec := httptest.NewRecorder()

	handler(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", res.StatusCode, http.StatusOK)
	}

	var body TemplatesResponse
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	if body.Source != "built-in" {
		t.Errorf("source = %q, want %q (expected fallback when key missing)", body.Source, "built-in")
	}

	if len(body.Templates) != 3 {
		t.Errorf("template count = %d, want 3 (built-in defaults)", len(body.Templates))
	}
}

func TestDeploymentTemplatesHandler_WrongNamespace(t *testing.T) {
	// Place the ConfigMap in a different namespace than what the handler
	// is configured with. The handler should not find it and fall back to
	// built-in defaults.
	cm := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      templatesConfigMapName,
			Namespace: "other-namespace",
		},
		Data: map[string]string{
			"templates.json": `[{"name":"should-not-appear","label":"Nope","description":"wrong ns","icon":"x","intent":{}}]`,
		},
	}

	fakeClientset := fake.NewSimpleClientset(cm)
	client := &k8s.Client{
		Clientset: fakeClientset,
	}

	handler := DeploymentTemplatesHandler(client, testNamespace)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/deployment-templates", nil)
	rec := httptest.NewRecorder()

	handler(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", res.StatusCode, http.StatusOK)
	}

	var body TemplatesResponse
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	if body.Source != "built-in" {
		t.Errorf("source = %q, want %q (ConfigMap in wrong namespace)", body.Source, "built-in")
	}

	// Confirm that none of the templates have the name from the wrong-namespace ConfigMap.
	for _, tmpl := range body.Templates {
		if tmpl.Name == "should-not-appear" {
			t.Error("response includes template from wrong namespace ConfigMap")
		}
	}
}

func TestDeploymentTemplatesHandler_SingleCustomTemplate(t *testing.T) {
	// A ConfigMap with a single valid template should be returned with
	// source "configmap" and exactly one template.
	customTemplates := []DeploymentTemplate{
		{
			Name:        "minimal",
			Label:       "Minimal",
			Description: "Bare-bones single node",
			Icon:        "compute",
			Intent:      json.RawMessage(`{"version":"8.17.0"}`),
		},
	}

	templatesJSON, err := json.Marshal(customTemplates)
	if err != nil {
		t.Fatalf("failed to marshal custom templates: %v", err)
	}

	cm := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      templatesConfigMapName,
			Namespace: testNamespace,
		},
		Data: map[string]string{
			"templates.json": string(templatesJSON),
		},
	}

	fakeClientset := fake.NewSimpleClientset(cm)
	client := &k8s.Client{
		Clientset: fakeClientset,
	}

	handler := DeploymentTemplatesHandler(client, testNamespace)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/deployment-templates", nil)
	rec := httptest.NewRecorder()

	handler(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", res.StatusCode, http.StatusOK)
	}

	var body TemplatesResponse
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	if body.Source != "configmap" {
		t.Errorf("source = %q, want %q", body.Source, "configmap")
	}

	if len(body.Templates) != 1 {
		t.Fatalf("template count = %d, want 1", len(body.Templates))
	}

	if body.Templates[0].Name != "minimal" {
		t.Errorf("templates[0].name = %q, want %q", body.Templates[0].Name, "minimal")
	}
}
