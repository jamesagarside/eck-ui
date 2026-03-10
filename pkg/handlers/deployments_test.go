package handlers

import (
	"testing"

	"github.com/jamesagarside/eck-ui/pkg/k8s"
)

// metaWith returns an ECKResourceMeta with the given spec fields.
func metaWith(name string, fields ...string) k8s.ECKResourceMeta {
	return k8s.ECKResourceMeta{
		Name:       name,
		SpecFields: fields,
	}
}

// --- applyConfig ---

func TestApplyConfig(t *testing.T) {
	t.Run("sets config when specFields includes config", func(t *testing.T) {
		spec := map[string]interface{}{}
		meta := metaWith("kibana", "version", "count", "config")
		comp := ComponentIntent{Config: map[string]interface{}{"server.host": "0.0.0.0"}}

		applyConfig(spec, meta, comp)

		cfg, ok := spec["config"].(map[string]interface{})
		if !ok {
			t.Fatal("expected spec.config to be set")
		}
		if cfg["server.host"] != "0.0.0.0" {
			t.Errorf("expected server.host=0.0.0.0, got %v", cfg["server.host"])
		}
	})

	t.Run("skips when config is empty", func(t *testing.T) {
		spec := map[string]interface{}{}
		meta := metaWith("kibana", "config")
		comp := ComponentIntent{Config: map[string]interface{}{}}

		applyConfig(spec, meta, comp)

		if _, ok := spec["config"]; ok {
			t.Error("expected no spec.config for empty config")
		}
	})

	t.Run("skips when specFields missing config", func(t *testing.T) {
		spec := map[string]interface{}{}
		meta := metaWith("kibana", "version", "count") // no "config"
		comp := ComponentIntent{Config: map[string]interface{}{"key": "val"}}

		applyConfig(spec, meta, comp)

		if _, ok := spec["config"]; ok {
			t.Error("expected no spec.config when config not in specFields")
		}
	})
}

// --- applyResources ---

func TestApplyResources(t *testing.T) {
	t.Run("sets container resources", func(t *testing.T) {
		spec := map[string]interface{}{}
		comp := ComponentIntent{
			Resources: &ResourcesIntent{
				MemoryRequest: "2Gi",
				MemoryLimit:   "4Gi",
				CPURequest:    "500m",
				CPULimit:      "2",
			},
		}

		applyResources(spec, comp)

		pt := spec["podTemplate"].(map[string]interface{})
		ps := pt["spec"].(map[string]interface{})
		containers := ps["containers"].([]interface{})
		c := containers[0].(map[string]interface{})
		res := c["resources"].(map[string]interface{})

		reqs := res["requests"].(map[string]interface{})
		if reqs["memory"] != "2Gi" {
			t.Errorf("expected memory request 2Gi, got %v", reqs["memory"])
		}
		if reqs["cpu"] != "500m" {
			t.Errorf("expected cpu request 500m, got %v", reqs["cpu"])
		}

		lims := res["limits"].(map[string]interface{})
		if lims["memory"] != "4Gi" {
			t.Errorf("expected memory limit 4Gi, got %v", lims["memory"])
		}
		if lims["cpu"] != "2" {
			t.Errorf("expected cpu limit 2, got %v", lims["cpu"])
		}
	})

	t.Run("skips when resources is nil", func(t *testing.T) {
		spec := map[string]interface{}{}
		comp := ComponentIntent{Resources: nil}

		applyResources(spec, comp)

		if _, ok := spec["podTemplate"]; ok {
			t.Error("expected no podTemplate for nil resources")
		}
	})

	t.Run("skips when all resource fields empty", func(t *testing.T) {
		spec := map[string]interface{}{}
		comp := ComponentIntent{Resources: &ResourcesIntent{}}

		applyResources(spec, comp)

		if _, ok := spec["podTemplate"]; ok {
			t.Error("expected no podTemplate for empty resources")
		}
	})

	t.Run("partial resources only sets what is provided", func(t *testing.T) {
		spec := map[string]interface{}{}
		comp := ComponentIntent{
			Resources: &ResourcesIntent{MemoryRequest: "1Gi"},
		}

		applyResources(spec, comp)

		pt := spec["podTemplate"].(map[string]interface{})
		ps := pt["spec"].(map[string]interface{})
		containers := ps["containers"].([]interface{})
		c := containers[0].(map[string]interface{})
		res := c["resources"].(map[string]interface{})

		if _, ok := res["limits"]; ok {
			t.Error("expected no limits when only request set")
		}
		reqs := res["requests"].(map[string]interface{})
		if _, ok := reqs["cpu"]; ok {
			t.Error("expected no cpu request when only memory set")
		}
	})
}

// --- applyPodTemplate ---

func TestApplyPodTemplate(t *testing.T) {
	t.Run("sets nodeSelector", func(t *testing.T) {
		spec := map[string]interface{}{}
		comp := ComponentIntent{
			PodTemplate: &PodTemplateIntent{
				NodeSelector: map[string]string{"disktype": "ssd"},
			},
		}

		applyPodTemplate(spec, comp)

		pt := spec["podTemplate"].(map[string]interface{})
		ps := pt["spec"].(map[string]interface{})
		ns := ps["nodeSelector"].(map[string]interface{})
		if ns["disktype"] != "ssd" {
			t.Errorf("expected disktype=ssd, got %v", ns["disktype"])
		}
	})

	t.Run("sets tolerations", func(t *testing.T) {
		spec := map[string]interface{}{}
		comp := ComponentIntent{
			PodTemplate: &PodTemplateIntent{
				Tolerations: []TolerationIntent{
					{Key: "node-role", Operator: "Equal", Value: "elastic", Effect: "NoSchedule"},
				},
			},
		}

		applyPodTemplate(spec, comp)

		pt := spec["podTemplate"].(map[string]interface{})
		ps := pt["spec"].(map[string]interface{})
		tols := ps["tolerations"].([]interface{})
		if len(tols) != 1 {
			t.Fatalf("expected 1 toleration, got %d", len(tols))
		}
		tol := tols[0].(map[string]interface{})
		if tol["key"] != "node-role" {
			t.Errorf("expected key=node-role, got %v", tol["key"])
		}
		if tol["value"] != "elastic" {
			t.Errorf("expected value=elastic, got %v", tol["value"])
		}
		if tol["effect"] != "NoSchedule" {
			t.Errorf("expected effect=NoSchedule, got %v", tol["effect"])
		}
	})

	t.Run("Exists operator omits value", func(t *testing.T) {
		spec := map[string]interface{}{}
		comp := ComponentIntent{
			PodTemplate: &PodTemplateIntent{
				Tolerations: []TolerationIntent{
					{Key: "special", Operator: "Exists"},
				},
			},
		}

		applyPodTemplate(spec, comp)

		pt := spec["podTemplate"].(map[string]interface{})
		ps := pt["spec"].(map[string]interface{})
		tols := ps["tolerations"].([]interface{})
		tol := tols[0].(map[string]interface{})
		if _, ok := tol["value"]; ok {
			t.Error("Exists operator should not include value")
		}
		if _, ok := tol["effect"]; ok {
			t.Error("empty effect should not be included")
		}
	})

	t.Run("sets affinity", func(t *testing.T) {
		spec := map[string]interface{}{}
		comp := ComponentIntent{
			PodTemplate: &PodTemplateIntent{
				Affinity: map[string]interface{}{
					"nodeAffinity": map[string]interface{}{"weight": 1},
				},
			},
		}

		applyPodTemplate(spec, comp)

		pt := spec["podTemplate"].(map[string]interface{})
		ps := pt["spec"].(map[string]interface{})
		aff := ps["affinity"].(map[string]interface{})
		if aff["nodeAffinity"] == nil {
			t.Error("expected nodeAffinity in affinity")
		}
	})

	t.Run("skips when nil", func(t *testing.T) {
		spec := map[string]interface{}{}
		comp := ComponentIntent{PodTemplate: nil}

		applyPodTemplate(spec, comp)

		if _, ok := spec["podTemplate"]; ok {
			t.Error("expected no podTemplate for nil")
		}
	})
}

// --- applyHTTP ---

func TestApplyHTTP(t *testing.T) {
	meta := metaWith("kibana", "version", "count", "http")

	t.Run("disables TLS", func(t *testing.T) {
		spec := map[string]interface{}{}
		comp := ComponentIntent{
			HTTP: &HTTPIntent{
				TLS: &TLSIntent{Disabled: true},
			},
		}

		applyHTTP(spec, meta, comp)

		h := spec["http"].(map[string]interface{})
		tls := h["tls"].(map[string]interface{})
		ssc := tls["selfSignedCertificate"].(map[string]interface{})
		if ssc["disabled"] != true {
			t.Error("expected selfSignedCertificate.disabled=true")
		}
	})

	t.Run("custom TLS secret", func(t *testing.T) {
		spec := map[string]interface{}{}
		comp := ComponentIntent{
			HTTP: &HTTPIntent{
				TLS: &TLSIntent{SecretName: "my-cert"},
			},
		}

		applyHTTP(spec, meta, comp)

		h := spec["http"].(map[string]interface{})
		tls := h["tls"].(map[string]interface{})
		cert := tls["certificate"].(map[string]interface{})
		if cert["secretName"] != "my-cert" {
			t.Errorf("expected secretName=my-cert, got %v", cert["secretName"])
		}
	})

	t.Run("sets service type", func(t *testing.T) {
		spec := map[string]interface{}{}
		comp := ComponentIntent{
			HTTP: &HTTPIntent{ServiceType: "LoadBalancer"},
		}

		applyHTTP(spec, meta, comp)

		h := spec["http"].(map[string]interface{})
		svc := h["service"].(map[string]interface{})
		svcSpec := svc["spec"].(map[string]interface{})
		if svcSpec["type"] != "LoadBalancer" {
			t.Errorf("expected type=LoadBalancer, got %v", svcSpec["type"])
		}
	})

	t.Run("skips when http not in specFields", func(t *testing.T) {
		spec := map[string]interface{}{}
		noHttpMeta := metaWith("beat", "version", "type") // no "http"
		comp := ComponentIntent{
			HTTP: &HTTPIntent{ServiceType: "LoadBalancer"},
		}

		applyHTTP(spec, noHttpMeta, comp)

		if _, ok := spec["http"]; ok {
			t.Error("expected no http when not in specFields")
		}
	})
}

// --- applyMonitoring ---

func TestApplyMonitoring(t *testing.T) {
	meta := metaWith("elasticsearch", "version", "nodeSets", "monitoring")

	t.Run("sets metrics and logs refs", func(t *testing.T) {
		spec := map[string]interface{}{}
		comp := ComponentIntent{
			Monitoring: &MonitoringIntent{
				MetricsRef: &RefIntent{Name: "monitoring-es"},
				LogsRef:    &RefIntent{Name: "logging-es"},
			},
		}

		applyMonitoring(spec, meta, comp)

		mon := spec["monitoring"].(map[string]interface{})
		metrics := mon["metrics"].(map[string]interface{})
		refs := metrics["elasticsearchRefs"].([]interface{})
		ref := refs[0].(map[string]interface{})
		if ref["name"] != "monitoring-es" {
			t.Errorf("expected metrics ref monitoring-es, got %v", ref["name"])
		}

		logs := mon["logs"].(map[string]interface{})
		logRefs := logs["elasticsearchRefs"].([]interface{})
		logRef := logRefs[0].(map[string]interface{})
		if logRef["name"] != "logging-es" {
			t.Errorf("expected logs ref logging-es, got %v", logRef["name"])
		}
	})

	t.Run("skips when monitoring not in specFields", func(t *testing.T) {
		spec := map[string]interface{}{}
		noMon := metaWith("kibana", "version", "count") // no "monitoring"
		comp := ComponentIntent{
			Monitoring: &MonitoringIntent{
				MetricsRef: &RefIntent{Name: "mon"},
			},
		}

		applyMonitoring(spec, noMon, comp)

		if _, ok := spec["monitoring"]; ok {
			t.Error("expected no monitoring when not in specFields")
		}
	})
}

// --- applyUpdateStrategy ---

func TestApplyUpdateStrategy(t *testing.T) {
	t.Run("sets change budget", func(t *testing.T) {
		spec := map[string]interface{}{}
		mu := 1
		ms := 2
		comp := ComponentIntent{
			UpdateStrategy: &UpdateStrategyIntent{
				MaxUnavailable: &mu,
				MaxSurge:       &ms,
			},
		}

		applyUpdateStrategy(spec, comp)

		us := spec["updateStrategy"].(map[string]interface{})
		cb := us["changeBudget"].(map[string]interface{})
		if cb["maxUnavailable"] != int64(1) {
			t.Errorf("expected maxUnavailable=1, got %v", cb["maxUnavailable"])
		}
		if cb["maxSurge"] != int64(2) {
			t.Errorf("expected maxSurge=2, got %v", cb["maxSurge"])
		}
	})

	t.Run("partial — only maxUnavailable", func(t *testing.T) {
		spec := map[string]interface{}{}
		mu := 0
		comp := ComponentIntent{
			UpdateStrategy: &UpdateStrategyIntent{MaxUnavailable: &mu},
		}

		applyUpdateStrategy(spec, comp)

		us := spec["updateStrategy"].(map[string]interface{})
		cb := us["changeBudget"].(map[string]interface{})
		if cb["maxUnavailable"] != int64(0) {
			t.Errorf("expected maxUnavailable=0, got %v", cb["maxUnavailable"])
		}
		if _, ok := cb["maxSurge"]; ok {
			t.Error("expected no maxSurge when nil")
		}
	})

	t.Run("skips when nil", func(t *testing.T) {
		spec := map[string]interface{}{}
		comp := ComponentIntent{UpdateStrategy: nil}

		applyUpdateStrategy(spec, comp)

		if _, ok := spec["updateStrategy"]; ok {
			t.Error("expected no updateStrategy for nil")
		}
	})
}

// --- applyESRefOverride ---

func TestApplyESRefOverride(t *testing.T) {
	t.Run("singular elasticsearchRef", func(t *testing.T) {
		spec := map[string]interface{}{}
		meta := metaWith("kibana", "version", "count", "elasticsearchRef")
		comp := ComponentIntent{
			ElasticsearchRef: &RefIntent{Name: "custom-es"},
		}

		applyESRefOverride(spec, meta, comp)

		ref := spec["elasticsearchRef"].(map[string]interface{})
		if ref["name"] != "custom-es" {
			t.Errorf("expected name=custom-es, got %v", ref["name"])
		}
	})

	t.Run("plural elasticsearchRefs", func(t *testing.T) {
		spec := map[string]interface{}{}
		meta := metaWith("agent", "version", "mode", "elasticsearchRefs")
		comp := ComponentIntent{
			ElasticsearchRef: &RefIntent{Name: "custom-es"},
		}

		applyESRefOverride(spec, meta, comp)

		refs := spec["elasticsearchRefs"].([]interface{})
		ref := refs[0].(map[string]interface{})
		if ref["name"] != "custom-es" {
			t.Errorf("expected name=custom-es, got %v", ref["name"])
		}
	})

	t.Run("skips when empty name", func(t *testing.T) {
		spec := map[string]interface{}{}
		meta := metaWith("kibana", "elasticsearchRef")
		comp := ComponentIntent{
			ElasticsearchRef: &RefIntent{Name: ""},
		}

		applyESRefOverride(spec, meta, comp)

		if _, ok := spec["elasticsearchRef"]; ok {
			t.Error("expected no ref for empty name")
		}
	})
}

// --- applyKibanaRefOverride ---

func TestApplyKibanaRefOverride(t *testing.T) {
	t.Run("sets kibanaRef", func(t *testing.T) {
		spec := map[string]interface{}{}
		meta := metaWith("apmserver", "version", "count", "kibanaRef")
		comp := ComponentIntent{
			KibanaRef: &RefIntent{Name: "my-kb"},
		}

		applyKibanaRefOverride(spec, meta, comp)

		ref := spec["kibanaRef"].(map[string]interface{})
		if ref["name"] != "my-kb" {
			t.Errorf("expected name=my-kb, got %v", ref["name"])
		}
	})

	t.Run("skips when kibanaRef not in specFields", func(t *testing.T) {
		spec := map[string]interface{}{}
		meta := metaWith("kibana", "version", "count") // no "kibanaRef"
		comp := ComponentIntent{
			KibanaRef: &RefIntent{Name: "my-kb"},
		}

		applyKibanaRefOverride(spec, meta, comp)

		if _, ok := spec["kibanaRef"]; ok {
			t.Error("expected no kibanaRef when not in specFields")
		}
	})
}

// --- ensurePodTemplateSpec ---

func TestEnsurePodTemplateSpec(t *testing.T) {
	t.Run("creates nested structure", func(t *testing.T) {
		spec := map[string]interface{}{}
		ps := ensurePodTemplateSpec(spec)

		if ps == nil {
			t.Fatal("expected podSpec to be non-nil")
		}
		// Should be reachable from spec
		pt := spec["podTemplate"].(map[string]interface{})
		if pt["spec"] == nil {
			t.Error("expected spec.podTemplate.spec to exist")
		}
	})

	t.Run("returns existing structure", func(t *testing.T) {
		existing := map[string]interface{}{"nodeSelector": map[string]interface{}{"a": "b"}}
		spec := map[string]interface{}{
			"podTemplate": map[string]interface{}{
				"spec": existing,
			},
		}

		ps := ensurePodTemplateSpec(spec)
		if ps["nodeSelector"] == nil {
			t.Error("expected existing content to be preserved")
		}
	})
}

// --- ensureContainers ---

func TestEnsureContainers(t *testing.T) {
	t.Run("creates container when none exist", func(t *testing.T) {
		podSpec := map[string]interface{}{}
		c := ensureContainers(podSpec, "elasticsearch")

		if c == nil {
			t.Fatal("expected container to be non-nil")
		}
		if c["name"] != "elasticsearch" {
			t.Errorf("expected name=elasticsearch, got %v", c["name"])
		}
	})

	t.Run("returns first existing container", func(t *testing.T) {
		existing := map[string]interface{}{"name": "kibana", "image": "docker.elastic.co/kibana"}
		podSpec := map[string]interface{}{
			"containers": []interface{}{existing},
		}

		c := ensureContainers(podSpec, "")
		if c["image"] != "docker.elastic.co/kibana" {
			t.Error("expected existing container to be returned")
		}
	})
}

// --- defaultSpecFields ---

func TestDefaultSpecFields(t *testing.T) {
	tests := []struct {
		resource string
		field    string
		want     bool
	}{
		// Common fields
		{"elasticsearch", "version", true},
		{"kibana", "config", true},
		{"elasticsearch", "monitoring", true},

		// HTTP — most have it, beats/agent don't
		{"kibana", "http", true},
		{"elasticsearch", "http", true},
		{"beat", "http", false},
		{"agent", "http", false},

		// ES-specific
		{"elasticsearch", "nodeSets", true},
		{"elasticsearch", "updateStrategy", true},
		{"kibana", "updateStrategy", false},

		// Ref fields
		{"kibana", "elasticsearchRef", true},
		{"agent", "elasticsearchRefs", true},
		{"apmserver", "kibanaRef", true},
		{"kibana", "kibanaRef", false},

		// Count/deployment
		{"kibana", "count", true},
		{"beat", "deployment", true},
		{"agent", "deployment", true},
	}

	for _, tt := range tests {
		t.Run(tt.resource+"/"+tt.field, func(t *testing.T) {
			got := defaultSpecFields(tt.resource, tt.field)
			if got != tt.want {
				t.Errorf("defaultSpecFields(%q, %q) = %v, want %v", tt.resource, tt.field, got, tt.want)
			}
		})
	}
}
