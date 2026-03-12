package resources

import (
	"fmt"
	"net/http"
	"testing"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// newAgent creates an unstructured Agent object with the given name and spec.
// If spec is nil, the object will have no spec field.
func newAgent(name string, spec map[string]interface{}) unstructured.Unstructured {
	obj := unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "agent.k8s.elastic.co/v1alpha1",
			"kind":       "Agent",
			"metadata": map[string]interface{}{
				"name":      name,
				"namespace": "default",
			},
		},
	}
	if spec != nil {
		obj.Object["spec"] = spec
	}
	return obj
}

// newAgentList creates an UnstructuredList with the Agent GVK and the given items.
func newAgentList(items ...unstructured.Unstructured) *unstructured.UnstructuredList {
	list := &unstructured.UnstructuredList{}
	list.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   "agent.k8s.elastic.co",
		Version: "v1alpha1",
		Kind:    "AgentList",
	})
	list.Items = items
	return list
}

func TestFilterAgentsByMode_FleetByMode(t *testing.T) {
	fleetAgent := newAgent("fleet-mode-agent", map[string]interface{}{
		"mode": "fleet",
	})
	standaloneAgent := newAgent("standalone-agent", map[string]interface{}{
		"mode": "standalone",
	})

	list := newAgentList(fleetAgent, standaloneAgent)
	result := filterAgentsByMode(list, "fleet")

	if len(result.Items) != 1 {
		t.Fatalf("item count = %d, want 1", len(result.Items))
	}
	if result.Items[0].GetName() != "fleet-mode-agent" {
		t.Errorf("name = %q, want %q", result.Items[0].GetName(), "fleet-mode-agent")
	}
}

func TestFilterAgentsByMode_FleetByFleetServerEnabled(t *testing.T) {
	fleetServerAgent := newAgent("fleet-server-agent", map[string]interface{}{
		"fleetServerEnabled": true,
	})
	standaloneAgent := newAgent("standalone-agent", map[string]interface{}{
		"image": "elastic/agent:8.17.0",
	})

	list := newAgentList(fleetServerAgent, standaloneAgent)
	result := filterAgentsByMode(list, "fleet")

	if len(result.Items) != 1 {
		t.Fatalf("item count = %d, want 1", len(result.Items))
	}
	if result.Items[0].GetName() != "fleet-server-agent" {
		t.Errorf("name = %q, want %q", result.Items[0].GetName(), "fleet-server-agent")
	}
}

func TestFilterAgentsByMode_StandaloneFilter(t *testing.T) {
	fleetAgent := newAgent("fleet-agent", map[string]interface{}{
		"mode": "fleet",
	})
	standaloneAgent := newAgent("standalone-agent", map[string]interface{}{
		"mode": "standalone",
	})

	list := newAgentList(fleetAgent, standaloneAgent)
	result := filterAgentsByMode(list, "standalone")

	if len(result.Items) != 1 {
		t.Fatalf("item count = %d, want 1", len(result.Items))
	}
	if result.Items[0].GetName() != "standalone-agent" {
		t.Errorf("name = %q, want %q", result.Items[0].GetName(), "standalone-agent")
	}
}

func TestFilterAgentsByMode_EmptyList(t *testing.T) {
	list := newAgentList()

	fleetResult := filterAgentsByMode(list, "fleet")
	if len(fleetResult.Items) != 0 {
		t.Errorf("fleet filter on empty list: item count = %d, want 0", len(fleetResult.Items))
	}

	standaloneResult := filterAgentsByMode(list, "standalone")
	if len(standaloneResult.Items) != 0 {
		t.Errorf("standalone filter on empty list: item count = %d, want 0", len(standaloneResult.Items))
	}
}

func TestFilterAgentsByMode_NilSpecTreatedAsStandalone(t *testing.T) {
	// An agent with no spec field should be treated as standalone.
	noSpecAgent := newAgent("no-spec-agent", nil)

	list := newAgentList(noSpecAgent)

	fleetResult := filterAgentsByMode(list, "fleet")
	if len(fleetResult.Items) != 0 {
		t.Errorf("fleet filter: item count = %d, want 0 (nil spec should not match fleet)", len(fleetResult.Items))
	}

	standaloneResult := filterAgentsByMode(list, "standalone")
	if len(standaloneResult.Items) != 1 {
		t.Fatalf("standalone filter: item count = %d, want 1 (nil spec should match standalone)", len(standaloneResult.Items))
	}
	if standaloneResult.Items[0].GetName() != "no-spec-agent" {
		t.Errorf("name = %q, want %q", standaloneResult.Items[0].GetName(), "no-spec-agent")
	}
}

func TestFilterAgentsByMode_MixedAgents(t *testing.T) {
	// Create a mix of fleet-by-mode, fleet-by-fleetServerEnabled, standalone,
	// and nil-spec agents to verify correct filtering in a realistic scenario.
	fleetByMode := newAgent("fleet-by-mode", map[string]interface{}{
		"mode": "fleet",
	})
	fleetByEnabled := newAgent("fleet-by-enabled", map[string]interface{}{
		"fleetServerEnabled": true,
	})
	fleetByBoth := newAgent("fleet-by-both", map[string]interface{}{
		"mode":               "fleet",
		"fleetServerEnabled": true,
	})
	standaloneExplicit := newAgent("standalone-explicit", map[string]interface{}{
		"mode": "standalone",
	})
	standaloneNoMode := newAgent("standalone-no-mode", map[string]interface{}{
		"image": "elastic/agent:8.17.0",
	})
	noSpec := newAgent("no-spec", nil)

	list := newAgentList(
		fleetByMode, fleetByEnabled, fleetByBoth,
		standaloneExplicit, standaloneNoMode, noSpec,
	)

	// Fleet filter should return the three fleet agents.
	fleetResult := filterAgentsByMode(list, "fleet")
	if len(fleetResult.Items) != 3 {
		t.Fatalf("fleet filter: item count = %d, want 3", len(fleetResult.Items))
	}
	wantFleet := map[string]bool{
		"fleet-by-mode":    true,
		"fleet-by-enabled": true,
		"fleet-by-both":    true,
	}
	for _, item := range fleetResult.Items {
		name := item.GetName()
		if !wantFleet[name] {
			t.Errorf("fleet filter: unexpected agent %q", name)
		}
		delete(wantFleet, name)
	}
	for name := range wantFleet {
		t.Errorf("fleet filter: missing expected agent %q", name)
	}

	// Standalone filter should return the two standalone agents plus the nil-spec agent.
	standaloneResult := filterAgentsByMode(list, "standalone")
	if len(standaloneResult.Items) != 3 {
		t.Fatalf("standalone filter: item count = %d, want 3", len(standaloneResult.Items))
	}
	wantStandalone := map[string]bool{
		"standalone-explicit": true,
		"standalone-no-mode":  true,
		"no-spec":             true,
	}
	for _, item := range standaloneResult.Items {
		name := item.GetName()
		if !wantStandalone[name] {
			t.Errorf("standalone filter: unexpected agent %q", name)
		}
		delete(wantStandalone, name)
	}
	for name := range wantStandalone {
		t.Errorf("standalone filter: missing expected agent %q", name)
	}
}

func TestFilterAgentsByMode_PreservesGroupVersionKind(t *testing.T) {
	list := newAgentList(newAgent("test-agent", map[string]interface{}{
		"mode": "fleet",
	}))

	result := filterAgentsByMode(list, "fleet")

	gotGVK := result.GroupVersionKind()
	wantGVK := list.GroupVersionKind()
	if gotGVK != wantGVK {
		t.Errorf("GVK = %v, want %v", gotGVK, wantGVK)
	}
}

// --- Pagination, filtering, and sorting tests ---

func newResource(name, namespace, version, health, phase string) unstructured.Unstructured {
	return unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "elasticsearch.k8s.elastic.co/v1",
			"kind":       "Elasticsearch",
			"metadata": map[string]interface{}{
				"name":      name,
				"namespace": namespace,
			},
			"spec": map[string]interface{}{
				"version": version,
			},
			"status": map[string]interface{}{
				"health": health,
				"phase":  phase,
			},
		},
	}
}

func TestFilterItems_SearchByName(t *testing.T) {
	items := []unstructured.Unstructured{
		newResource("prod-logging", "default", "8.17.0", "green", "Ready"),
		newResource("staging-logging", "staging", "8.17.0", "yellow", "Ready"),
		newResource("prod-metrics", "default", "8.17.0", "green", "Ready"),
	}

	params := listParams{Search: "logging"}
	filtered := filterItems(items, params)
	if len(filtered) != 2 {
		t.Fatalf("got %d items, want 2", len(filtered))
	}
}

func TestFilterItems_HealthFilter(t *testing.T) {
	items := []unstructured.Unstructured{
		newResource("es1", "default", "8.17.0", "green", "Ready"),
		newResource("es2", "default", "8.17.0", "yellow", "Ready"),
		newResource("es3", "default", "8.17.0", "red", "Stalled"),
	}

	params := listParams{Health: []string{"red", "yellow"}}
	filtered := filterItems(items, params)
	if len(filtered) != 2 {
		t.Fatalf("got %d items, want 2", len(filtered))
	}
}

func TestFilterItems_CombinedFilters(t *testing.T) {
	items := []unstructured.Unstructured{
		newResource("prod-logging", "default", "8.17.0", "green", "Ready"),
		newResource("prod-metrics", "default", "8.17.0", "red", "Stalled"),
		newResource("staging-logging", "staging", "8.17.0", "red", "Stalled"),
	}

	params := listParams{Search: "prod", Health: []string{"red"}}
	filtered := filterItems(items, params)
	if len(filtered) != 1 {
		t.Fatalf("got %d items, want 1", len(filtered))
	}
	if filtered[0].GetName() != "prod-metrics" {
		t.Errorf("got %q, want prod-metrics", filtered[0].GetName())
	}
}

func TestSortItems_ByNameAsc(t *testing.T) {
	items := []unstructured.Unstructured{
		newResource("charlie", "default", "8.17.0", "green", "Ready"),
		newResource("alpha", "default", "8.17.0", "green", "Ready"),
		newResource("bravo", "default", "8.17.0", "green", "Ready"),
	}

	sortItems(items, "name", "asc")
	if items[0].GetName() != "alpha" || items[1].GetName() != "bravo" || items[2].GetName() != "charlie" {
		t.Errorf("sort asc: got %s, %s, %s", items[0].GetName(), items[1].GetName(), items[2].GetName())
	}
}

func TestSortItems_ByNameDesc(t *testing.T) {
	items := []unstructured.Unstructured{
		newResource("alpha", "default", "8.17.0", "green", "Ready"),
		newResource("charlie", "default", "8.17.0", "green", "Ready"),
		newResource("bravo", "default", "8.17.0", "green", "Ready"),
	}

	sortItems(items, "name", "desc")
	if items[0].GetName() != "charlie" || items[1].GetName() != "bravo" || items[2].GetName() != "alpha" {
		t.Errorf("sort desc: got %s, %s, %s", items[0].GetName(), items[1].GetName(), items[2].GetName())
	}
}

func TestPaginateItems_FirstPage(t *testing.T) {
	items := make([]unstructured.Unstructured, 50)
	for i := range items {
		items[i] = newResource(fmt.Sprintf("es-%02d", i), "default", "8.17.0", "green", "Ready")
	}

	paged := paginateItems(items, 1, 25)
	if len(paged) != 25 {
		t.Fatalf("got %d items, want 25", len(paged))
	}
	if paged[0].GetName() != "es-00" {
		t.Errorf("first item = %q, want es-00", paged[0].GetName())
	}
}

func TestPaginateItems_LastPage(t *testing.T) {
	items := make([]unstructured.Unstructured, 30)
	for i := range items {
		items[i] = newResource(fmt.Sprintf("es-%02d", i), "default", "8.17.0", "green", "Ready")
	}

	paged := paginateItems(items, 2, 25)
	if len(paged) != 5 {
		t.Fatalf("got %d items, want 5", len(paged))
	}
	if paged[0].GetName() != "es-25" {
		t.Errorf("first item = %q, want es-25", paged[0].GetName())
	}
}

func TestPaginateItems_BeyondLastPage(t *testing.T) {
	items := make([]unstructured.Unstructured, 10)
	for i := range items {
		items[i] = newResource(fmt.Sprintf("es-%02d", i), "default", "8.17.0", "green", "Ready")
	}

	paged := paginateItems(items, 5, 25)
	if paged != nil {
		t.Fatalf("got %d items, want nil", len(paged))
	}
}

func TestParseListParams_Defaults(t *testing.T) {
	r, _ := http.NewRequest("GET", "/api/v1/elasticsearch", nil)
	params := parseListParams(r)

	if params.Page != 1 {
		t.Errorf("page = %d, want 1", params.Page)
	}
	if params.PageSize != 25 {
		t.Errorf("pageSize = %d, want 25", params.PageSize)
	}
	if params.Order != "asc" {
		t.Errorf("order = %q, want asc", params.Order)
	}
}

func TestParseListParams_MaxPageSize(t *testing.T) {
	r, _ := http.NewRequest("GET", "/api/v1/elasticsearch?pageSize=500", nil)
	params := parseListParams(r)

	if params.PageSize != 100 {
		t.Errorf("pageSize = %d, want 100 (capped)", params.PageSize)
	}
}

func TestFilterAgentsByMode_FleetServerEnabledFalse(t *testing.T) {
	// An agent with fleetServerEnabled explicitly set to false should be
	// treated as standalone (the bool zero value is false, so this also
	// validates that only true triggers fleet classification).
	agent := newAgent("not-fleet", map[string]interface{}{
		"fleetServerEnabled": false,
	})

	list := newAgentList(agent)

	fleetResult := filterAgentsByMode(list, "fleet")
	if len(fleetResult.Items) != 0 {
		t.Errorf("fleet filter: item count = %d, want 0 (fleetServerEnabled=false)", len(fleetResult.Items))
	}

	standaloneResult := filterAgentsByMode(list, "standalone")
	if len(standaloneResult.Items) != 1 {
		t.Fatalf("standalone filter: item count = %d, want 1", len(standaloneResult.Items))
	}
	if standaloneResult.Items[0].GetName() != "not-fleet" {
		t.Errorf("name = %q, want %q", standaloneResult.Items[0].GetName(), "not-fleet")
	}
}
