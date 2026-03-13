package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/mux"
	"github.com/jamesagarside/eck-ui/pkg/k8s"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	k8sfake "k8s.io/client-go/kubernetes/fake"
)

// newPodTestClient creates a k8s.Client backed by a fake clientset seeded
// with the provided runtime objects (typically *corev1.Pod values).
func newPodTestClient(objects ...runtime.Object) *k8s.Client {
	return &k8s.Client{
		Clientset: k8sfake.NewSimpleClientset(objects...),
	}
}

// newPodListRouter wires up the PodListHandler on a mux router so that
// gorilla/mux path variables are populated correctly.
func newPodListRouter(client *k8s.Client) *mux.Router {
	r := mux.NewRouter()
	r.HandleFunc("/api/v1/pods/{namespace}", PodListHandler(client)).Methods(http.MethodGet)
	return r
}

// newPodLogsRouter wires up the PodLogsHandler on a mux router.
func newPodLogsRouter(client *k8s.Client) *mux.Router {
	r := mux.NewRouter()
	r.HandleFunc("/api/v1/pods/{namespace}/{pod}/logs", PodLogsHandler(client)).Methods(http.MethodGet)
	return r
}

// testPod creates a corev1.Pod with the given name, namespace, labels, and
// container statuses for test seeding.
func testPod(name, namespace string, labels map[string]string, phase corev1.PodPhase, node string, containers []corev1.ContainerStatus) *corev1.Pod {
	return &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:              name,
			Namespace:         namespace,
			Labels:            labels,
			CreationTimestamp: metav1.NewTime(time.Date(2025, 1, 15, 10, 0, 0, 0, time.UTC)),
		},
		Spec: corev1.PodSpec{
			NodeName: node,
		},
		Status: corev1.PodStatus{
			Phase:             phase,
			ContainerStatuses: containers,
		},
	}
}

func TestPodListHandler_MatchingLabelSelector(t *testing.T) {
	pod1 := testPod("es-node-0", "elastic", map[string]string{
		"common.k8s.elastic.co/type":                "elasticsearch",
		"elasticsearch.k8s.elastic.co/cluster-name": "prod-es",
	}, corev1.PodRunning, "node-1", []corev1.ContainerStatus{
		{Name: "elasticsearch", Ready: true, RestartCount: 0, State: corev1.ContainerState{Running: &corev1.ContainerStateRunning{}}},
	})
	pod2 := testPod("kb-abc123", "elastic", map[string]string{
		"common.k8s.elastic.co/type": "kibana",
		"kibana.k8s.elastic.co/name": "prod-kb",
	}, corev1.PodRunning, "node-2", []corev1.ContainerStatus{
		{Name: "kibana", Ready: true, RestartCount: 1, State: corev1.ContainerState{Running: &corev1.ContainerStateRunning{}}},
	})

	client := newPodTestClient(pod1, pod2)
	router := newPodListRouter(client)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/pods/elastic?labelSelector=common.k8s.elastic.co/type=elasticsearch", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", res.StatusCode, http.StatusOK)
	}

	var summaries []PodSummary
	if err := json.NewDecoder(res.Body).Decode(&summaries); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(summaries) != 1 {
		t.Fatalf("got %d pods, want 1", len(summaries))
	}

	if summaries[0].Name != "es-node-0" {
		t.Errorf("name = %q, want %q", summaries[0].Name, "es-node-0")
	}
}

func TestPodListHandler_EmptyResult(t *testing.T) {
	client := newPodTestClient()
	router := newPodListRouter(client)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/pods/no-such-ns?labelSelector=app=nonexistent", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", res.StatusCode, http.StatusOK)
	}

	var summaries []PodSummary
	if err := json.NewDecoder(res.Body).Decode(&summaries); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(summaries) != 0 {
		t.Errorf("got %d pods, want 0", len(summaries))
	}
}

func TestPodListHandler_ContentType(t *testing.T) {
	client := newPodTestClient()
	router := newPodListRouter(client)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/pods/default", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	ct := res.Header.Get("Content-Type")
	want := "application/json; charset=utf-8"
	if ct != want {
		t.Errorf("Content-Type = %q, want %q", ct, want)
	}
}

func TestPodListHandler_PodSummaryFields(t *testing.T) {
	pod := testPod("es-data-0", "production", map[string]string{
		"common.k8s.elastic.co/type":                "elasticsearch",
		"elasticsearch.k8s.elastic.co/cluster-name": "main-cluster",
	}, corev1.PodRunning, "worker-3", []corev1.ContainerStatus{
		{
			Name:         "elasticsearch",
			Ready:        true,
			RestartCount: 5,
			State:        corev1.ContainerState{Running: &corev1.ContainerStateRunning{}},
		},
		{
			Name:         "sidecar",
			Ready:        false,
			RestartCount: 2,
			State:        corev1.ContainerState{Waiting: &corev1.ContainerStateWaiting{Reason: "CrashLoopBackOff"}},
		},
	})

	client := newPodTestClient(pod)
	router := newPodListRouter(client)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/pods/production", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	var summaries []PodSummary
	if err := json.NewDecoder(res.Body).Decode(&summaries); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(summaries) != 1 {
		t.Fatalf("got %d pods, want 1", len(summaries))
	}

	s := summaries[0]

	if s.Name != "es-data-0" {
		t.Errorf("Name = %q, want %q", s.Name, "es-data-0")
	}
	if s.Namespace != "production" {
		t.Errorf("Namespace = %q, want %q", s.Namespace, "production")
	}
	if s.Phase != "Running" {
		t.Errorf("Phase = %q, want %q", s.Phase, "Running")
	}
	if s.Ready != "1/2" {
		t.Errorf("Ready = %q, want %q", s.Ready, "1/2")
	}
	if s.Restarts != 7 {
		t.Errorf("Restarts = %d, want %d", s.Restarts, 7)
	}
	if s.Node != "worker-3" {
		t.Errorf("Node = %q, want %q", s.Node, "worker-3")
	}
	if s.ComponentType != "elasticsearch" {
		t.Errorf("ComponentType = %q, want %q", s.ComponentType, "elasticsearch")
	}
	if s.ComponentName != "main-cluster" {
		t.Errorf("ComponentName = %q, want %q", s.ComponentName, "main-cluster")
	}
	if s.CreatedAt != "2025-01-15T10:00:00Z" {
		t.Errorf("CreatedAt = %q, want %q", s.CreatedAt, "2025-01-15T10:00:00Z")
	}

	// Verify containers.
	if len(s.Containers) != 2 {
		t.Fatalf("len(Containers) = %d, want 2", len(s.Containers))
	}
	if s.Containers[0].Name != "elasticsearch" {
		t.Errorf("Containers[0].Name = %q, want %q", s.Containers[0].Name, "elasticsearch")
	}
	if !s.Containers[0].Ready {
		t.Error("Containers[0].Ready = false, want true")
	}
	if s.Containers[0].State != "running" {
		t.Errorf("Containers[0].State = %q, want %q", s.Containers[0].State, "running")
	}
	if s.Containers[1].Name != "sidecar" {
		t.Errorf("Containers[1].Name = %q, want %q", s.Containers[1].Name, "sidecar")
	}
	if s.Containers[1].Ready {
		t.Error("Containers[1].Ready = true, want false")
	}
	if s.Containers[1].State != "waiting" {
		t.Errorf("Containers[1].State = %q, want %q", s.Containers[1].State, "waiting")
	}
}

func TestPodListHandler_InitContainers(t *testing.T) {
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:              "es-init-0",
			Namespace:         "default",
			CreationTimestamp: metav1.NewTime(time.Date(2025, 1, 15, 10, 0, 0, 0, time.UTC)),
		},
		Status: corev1.PodStatus{
			Phase: corev1.PodRunning,
			ContainerStatuses: []corev1.ContainerStatus{
				{Name: "main", Ready: true, State: corev1.ContainerState{Running: &corev1.ContainerStateRunning{}}},
			},
			InitContainerStatuses: []corev1.ContainerStatus{
				{Name: "setup", Ready: false, State: corev1.ContainerState{Terminated: &corev1.ContainerStateTerminated{ExitCode: 0}}},
			},
		},
	}

	client := newPodTestClient(pod)
	router := newPodListRouter(client)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/pods/default", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	var summaries []PodSummary
	if err := json.NewDecoder(res.Body).Decode(&summaries); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(summaries) != 1 {
		t.Fatalf("got %d pods, want 1", len(summaries))
	}

	s := summaries[0]

	// 1 main container + 1 init container = 2 total in the containers list.
	if len(s.Containers) != 2 {
		t.Fatalf("len(Containers) = %d, want 2", len(s.Containers))
	}

	// Init container name is prefixed with "init:".
	initContainer := s.Containers[1]
	if initContainer.Name != "init:setup" {
		t.Errorf("init container Name = %q, want %q", initContainer.Name, "init:setup")
	}
	if initContainer.State != "terminated" {
		t.Errorf("init container State = %q, want %q", initContainer.State, "terminated")
	}

	// Ready count only considers main container statuses, not init.
	if s.Ready != "1/1" {
		t.Errorf("Ready = %q, want %q", s.Ready, "1/1")
	}
}

func TestPodListHandler_ComponentTypeLabels(t *testing.T) {
	tests := []struct {
		name          string
		labels        map[string]string
		wantType      string
		wantComponent string
	}{
		{
			name: "kibana",
			labels: map[string]string{
				"common.k8s.elastic.co/type": "kibana",
				"kibana.k8s.elastic.co/name": "my-kb",
			},
			wantType:      "kibana",
			wantComponent: "my-kb",
		},
		{
			name: "apm",
			labels: map[string]string{
				"common.k8s.elastic.co/type": "apm",
				"apm.k8s.elastic.co/name":    "my-apm",
			},
			wantType:      "apm",
			wantComponent: "my-apm",
		},
		{
			name: "beat",
			labels: map[string]string{
				"common.k8s.elastic.co/type": "beat",
				"beat.k8s.elastic.co/name":   "filebeat",
			},
			wantType:      "beat",
			wantComponent: "filebeat",
		},
		{
			name: "agent",
			labels: map[string]string{
				"common.k8s.elastic.co/type": "agent",
				"agent.k8s.elastic.co/name":  "fleet-agent",
			},
			wantType:      "agent",
			wantComponent: "fleet-agent",
		},
		{
			name: "logstash",
			labels: map[string]string{
				"common.k8s.elastic.co/type":    "logstash",
				"logstash.k8s.elastic.co/name":  "my-ls",
			},
			wantType:      "logstash",
			wantComponent: "my-ls",
		},
		{
			name: "enterprise-search",
			labels: map[string]string{
				"common.k8s.elastic.co/type":           "enterprise-search",
				"enterprisesearch.k8s.elastic.co/name": "my-ent",
			},
			wantType:      "enterprise-search",
			wantComponent: "my-ent",
		},
		{
			name: "maps",
			labels: map[string]string{
				"common.k8s.elastic.co/type": "maps",
				"maps.k8s.elastic.co/name":   "my-maps",
			},
			wantType:      "maps",
			wantComponent: "my-maps",
		},
		{
			name:          "no labels",
			labels:        map[string]string{},
			wantType:      "",
			wantComponent: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pod := testPod("pod-"+tt.name, "default", tt.labels, corev1.PodRunning, "node-1", nil)

			client := newPodTestClient(pod)
			router := newPodListRouter(client)

			req := httptest.NewRequest(http.MethodGet, "/api/v1/pods/default", nil)
			rec := httptest.NewRecorder()

			router.ServeHTTP(rec, req)

			res := rec.Result()
			defer res.Body.Close()

			var summaries []PodSummary
			if err := json.NewDecoder(res.Body).Decode(&summaries); err != nil {
				t.Fatalf("failed to decode response: %v", err)
			}

			if len(summaries) != 1 {
				t.Fatalf("got %d pods, want 1", len(summaries))
			}

			if summaries[0].ComponentType != tt.wantType {
				t.Errorf("ComponentType = %q, want %q", summaries[0].ComponentType, tt.wantType)
			}
			if summaries[0].ComponentName != tt.wantComponent {
				t.Errorf("ComponentName = %q, want %q", summaries[0].ComponentName, tt.wantComponent)
			}
		})
	}
}

func TestPodListHandler_NoLabelSelector(t *testing.T) {
	// When no labelSelector query param is provided, all pods in the
	// namespace should be returned.
	pod1 := testPod("pod-a", "ns1", map[string]string{"app": "a"}, corev1.PodRunning, "node-1", nil)
	pod2 := testPod("pod-b", "ns1", map[string]string{"app": "b"}, corev1.PodPending, "node-2", nil)
	pod3 := testPod("pod-c", "ns2", map[string]string{"app": "c"}, corev1.PodRunning, "node-1", nil)

	client := newPodTestClient(pod1, pod2, pod3)
	router := newPodListRouter(client)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/pods/ns1", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	var summaries []PodSummary
	if err := json.NewDecoder(res.Body).Decode(&summaries); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(summaries) != 2 {
		t.Errorf("got %d pods from ns1, want 2", len(summaries))
	}
}

func TestPodListHandler_ContainerStateTerminated(t *testing.T) {
	pod := testPod("terminated-pod", "default", nil, corev1.PodSucceeded, "node-1", []corev1.ContainerStatus{
		{
			Name:  "job",
			Ready: false,
			State: corev1.ContainerState{Terminated: &corev1.ContainerStateTerminated{ExitCode: 0}},
		},
	})

	client := newPodTestClient(pod)
	router := newPodListRouter(client)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/pods/default", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	var summaries []PodSummary
	if err := json.NewDecoder(res.Body).Decode(&summaries); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(summaries) != 1 {
		t.Fatalf("got %d pods, want 1", len(summaries))
	}

	if summaries[0].Containers[0].State != "terminated" {
		t.Errorf("container state = %q, want %q", summaries[0].Containers[0].State, "terminated")
	}
	if summaries[0].Phase != "Succeeded" {
		t.Errorf("Phase = %q, want %q", summaries[0].Phase, "Succeeded")
	}
}

func TestPodLogsHandler_SetsSSEHeaders(t *testing.T) {
	// The fake clientset returns an empty stream for GetLogs, so the handler
	// should still set SSE headers and return 200 with a "done" event.
	pod := testPod("log-pod", "default", nil, corev1.PodRunning, "node-1", []corev1.ContainerStatus{
		{Name: "main", Ready: true, State: corev1.ContainerState{Running: &corev1.ContainerStateRunning{}}},
	})

	client := newPodTestClient(pod)
	router := newPodLogsRouter(client)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/pods/default/log-pod/logs?container=main&tailLines=100", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", res.StatusCode, http.StatusOK)
	}

	ct := res.Header.Get("Content-Type")
	if ct != "text/event-stream" {
		t.Errorf("Content-Type = %q, want %q", ct, "text/event-stream")
	}

	cc := res.Header.Get("Cache-Control")
	if cc != "no-cache" {
		t.Errorf("Cache-Control = %q, want %q", cc, "no-cache")
	}

	// The fake returns an empty stream with follow=false (default), so
	// the handler should emit a "done" event.
	body, _ := io.ReadAll(res.Body)
	if !strings.Contains(string(body), "event: done") {
		t.Errorf("expected 'event: done' in SSE body, got: %s", string(body))
	}
}

func TestPodLogsHandler_RespectsFollowFalse(t *testing.T) {
	// Without follow=true the handler should emit "event: done" when the
	// stream ends (the fake clientset always returns an empty stream).
	pod := testPod("log-pod", "default", nil, corev1.PodRunning, "node-1", []corev1.ContainerStatus{
		{Name: "main", Ready: true, State: corev1.ContainerState{Running: &corev1.ContainerStateRunning{}}},
	})

	client := newPodTestClient(pod)
	router := newPodLogsRouter(client)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/pods/default/log-pod/logs?container=main", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	body, _ := io.ReadAll(res.Body)
	if !strings.Contains(string(body), "event: done") {
		t.Errorf("expected 'event: done' for non-follow stream, got: %s", string(body))
	}
}

func TestToPodSummary_ZeroContainers(t *testing.T) {
	pod := corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:              "empty-pod",
			Namespace:         "default",
			CreationTimestamp: metav1.NewTime(time.Date(2025, 6, 1, 12, 0, 0, 0, time.UTC)),
		},
		Spec: corev1.PodSpec{
			NodeName: "node-1",
		},
		Status: corev1.PodStatus{
			Phase: corev1.PodPending,
		},
	}

	s := toPodSummary(pod)

	if s.Ready != "0/0" {
		t.Errorf("Ready = %q, want %q", s.Ready, "0/0")
	}
	if s.Restarts != 0 {
		t.Errorf("Restarts = %d, want 0", s.Restarts)
	}
	if len(s.Containers) != 0 {
		t.Errorf("len(Containers) = %d, want 0", len(s.Containers))
	}
}

func TestToPodSummary_RestartsAcrossContainers(t *testing.T) {
	pod := corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:              "multi-restart",
			Namespace:         "default",
			CreationTimestamp: metav1.NewTime(time.Date(2025, 6, 1, 12, 0, 0, 0, time.UTC)),
		},
		Status: corev1.PodStatus{
			Phase: corev1.PodRunning,
			ContainerStatuses: []corev1.ContainerStatus{
				{Name: "a", Ready: true, RestartCount: 3, State: corev1.ContainerState{Running: &corev1.ContainerStateRunning{}}},
				{Name: "b", Ready: true, RestartCount: 10, State: corev1.ContainerState{Running: &corev1.ContainerStateRunning{}}},
				{Name: "c", Ready: true, RestartCount: 0, State: corev1.ContainerState{Running: &corev1.ContainerStateRunning{}}},
			},
		},
	}

	s := toPodSummary(pod)

	if s.Restarts != 13 {
		t.Errorf("Restarts = %d, want 13", s.Restarts)
	}
	if s.Ready != "3/3" {
		t.Errorf("Ready = %q, want %q", s.Ready, "3/3")
	}
}
