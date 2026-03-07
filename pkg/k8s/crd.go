package k8s

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// ECKResourceMeta holds discovered metadata for a single ECK CRD.
type ECKResourceMeta struct {
	Name       string   `json:"name"`       // e.g. "agent"
	Group      string   `json:"group"`      // e.g. "agent.k8s.elastic.co"
	Version    string   `json:"version"`    // e.g. "v1alpha1"
	Resource   string   `json:"resource"`   // e.g. "agents"
	Kind       string   `json:"kind"`       // e.g. "Agent"
	APIVersion string   `json:"apiVersion"` // e.g. "agent.k8s.elastic.co/v1alpha1"
	SpecFields []string `json:"specFields"` // top-level spec field names
}

// CRDRegistry maintains a cache of discovered ECK CRD metadata.
type CRDRegistry struct {
	mu        sync.RWMutex
	resources map[string]ECKResourceMeta // keyed by our internal name
	lastSync  time.Time
	client    *Client
}

// NewCRDRegistry creates and initialises a CRD registry. It performs an
// initial synchronous discovery and starts a background refresh goroutine.
func NewCRDRegistry(client *Client) *CRDRegistry {
	r := &CRDRegistry{
		resources: make(map[string]ECKResourceMeta),
		client:    client,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := r.sync(ctx); err != nil {
		slog.Warn("initial CRD discovery failed, using hardcoded defaults", "error", err)
	}

	go r.refreshLoop()
	return r
}

// Lookup returns the ECKResourceMeta for an internal resource name.
// Returns ok=false if not found.
func (r *CRDRegistry) Lookup(name string) (ECKResourceMeta, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	m, ok := r.resources[name]
	return m, ok
}

// All returns all discovered resource metadata.
func (r *CRDRegistry) All() []ECKResourceMeta {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]ECKResourceMeta, 0, len(r.resources))
	for _, m := range r.resources {
		result = append(result, m)
	}
	return result
}

// Source returns "crd-discovery" if the registry was populated from live CRDs,
// or "hardcoded" if it fell back.
func (r *CRDRegistry) Source() string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.lastSync.IsZero() {
		return "hardcoded"
	}
	return "crd-discovery"
}

// ResolveGVR returns a GVR from the registry, falling back to the hardcoded map.
func (r *CRDRegistry) ResolveGVR(resourceType string) (schema.GroupVersionResource, error) {
	if meta, ok := r.Lookup(resourceType); ok {
		return schema.GroupVersionResource{
			Group:    meta.Group,
			Version:  meta.Version,
			Resource: meta.Resource,
		}, nil
	}
	// Fall back to hardcoded
	return ResolveGVR(resourceType)
}

// crdGVR is the GVR for CustomResourceDefinition objects.
var crdGVR = schema.GroupVersionResource{
	Group:    "apiextensions.k8s.io",
	Version:  "v1",
	Resource: "customresourcedefinitions",
}

// internalName maps a CRD group to the internal name used in URL paths.
// This bridges CRD groups to our route names.
var groupToName = map[string]string{
	"elasticsearch.k8s.elastic.co":     "elasticsearch",
	"kibana.k8s.elastic.co":            "kibana",
	"apm.k8s.elastic.co":              "apmserver",
	"beat.k8s.elastic.co":             "beat",
	"agent.k8s.elastic.co":            "agent",
	"logstash.k8s.elastic.co":         "logstash",
	"enterprisesearch.k8s.elastic.co": "enterprisesearch",
	"maps.k8s.elastic.co":            "elasticmapsserver",
	"autoscaling.k8s.elastic.co":     "elasticsearchautoscaler",
	"stackconfigpolicy.k8s.elastic.co": "stackconfigpolicy",
}

func (r *CRDRegistry) sync(ctx context.Context) error {
	crdList, err := r.client.Dynamic.Resource(crdGVR).List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("listing CRDs: %w", err)
	}

	discovered := make(map[string]ECKResourceMeta)

	for _, crd := range crdList.Items {
		group, _, _ := unstructured.NestedString(crd.Object, "spec", "group")
		if !strings.HasSuffix(group, ".k8s.elastic.co") {
			continue
		}

		internalName, ok := groupToName[group]
		if !ok {
			// Unknown ECK CRD — skip
			continue
		}

		kind, _, _ := unstructured.NestedString(crd.Object, "spec", "names", "kind")
		plural, _, _ := unstructured.NestedString(crd.Object, "spec", "names", "plural")

		// Find the active (served) version
		versions, _, _ := unstructured.NestedSlice(crd.Object, "spec", "versions")
		activeVersion := ""
		var specFields []string

		for _, v := range versions {
			vm, ok := v.(map[string]interface{})
			if !ok {
				continue
			}
			served, _, _ := unstructured.NestedBool(vm, "served")
			storage, _, _ := unstructured.NestedBool(vm, "storage")
			vName, _, _ := unstructured.NestedString(vm, "name")

			if served && (activeVersion == "" || storage) {
				activeVersion = vName
			}

			// Extract top-level spec field names from the storage version's schema
			if storage {
				specProps, found, _ := unstructured.NestedMap(vm,
					"schema", "openAPIV3Schema", "properties", "spec", "properties")
				if found {
					specFields = make([]string, 0, len(specProps))
					for k := range specProps {
						specFields = append(specFields, k)
					}
				}
			}
		}

		if activeVersion == "" || kind == "" || plural == "" {
			continue
		}

		discovered[internalName] = ECKResourceMeta{
			Name:       internalName,
			Group:      group,
			Version:    activeVersion,
			Resource:   plural,
			Kind:       kind,
			APIVersion: fmt.Sprintf("%s/%s", group, activeVersion),
			SpecFields: specFields,
		}
	}

	if len(discovered) == 0 {
		return fmt.Errorf("no ECK CRDs found")
	}

	r.mu.Lock()
	r.resources = discovered
	r.lastSync = time.Now()
	r.mu.Unlock()

	slog.Info("CRD discovery completed", "count", len(discovered))
	return nil
}

func (r *CRDRegistry) refreshLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		if err := r.sync(ctx); err != nil {
			slog.Warn("CRD refresh failed", "error", err)
		}
		cancel()
	}
}
