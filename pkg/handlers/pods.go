package handlers

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"github.com/jamesagarside/eck-ui/pkg/k8s"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// PodSummary is a simplified pod representation for the UI.
type PodSummary struct {
	Name           string            `json:"name"`
	Namespace      string            `json:"namespace"`
	Phase          string            `json:"phase"`
	Ready          string            `json:"ready"`
	Restarts       int32             `json:"restarts"`
	Node           string            `json:"node"`
	Age            string            `json:"age"`
	CreatedAt      string            `json:"createdAt"`
	Containers     []ContainerInfo   `json:"containers"`
	Labels         map[string]string `json:"labels,omitempty"`
	ComponentType  string            `json:"componentType,omitempty"`
	ComponentName  string            `json:"componentName,omitempty"`
}

// ContainerInfo describes a single container in a pod.
type ContainerInfo struct {
	Name  string `json:"name"`
	Ready bool   `json:"ready"`
	State string `json:"state"`
}

// PodListHandler returns pods matching a label selector in a namespace.
//
//	GET /api/v1/pods/{namespace}?labelSelector=...
func PodListHandler(client *k8s.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ns := mux.Vars(r)["namespace"]
		selector := r.URL.Query().Get("labelSelector")

		pods, err := client.Clientset.CoreV1().Pods(ns).List(r.Context(), metav1.ListOptions{
			LabelSelector: selector,
		})
		if err != nil {
			http.Error(w, fmt.Sprintf("failed to list pods: %v", err), http.StatusInternalServerError)
			return
		}

		summaries := make([]PodSummary, 0, len(pods.Items))
		for _, pod := range pods.Items {
			summaries = append(summaries, toPodSummary(pod))
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		json.NewEncoder(w).Encode(summaries)
	}
}

// PodLogsHandler streams pod logs as Server-Sent Events.
//
//	GET /api/v1/pods/{namespace}/{pod}/logs?container=&follow=true&tailLines=1000
func PodLogsHandler(client *k8s.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		ns := vars["namespace"]
		podName := vars["pod"]
		container := r.URL.Query().Get("container")
		follow := r.URL.Query().Get("follow") == "true"
		tailLines := int64(1000)
		if tl := r.URL.Query().Get("tailLines"); tl != "" {
			if parsed, err := strconv.ParseInt(tl, 10, 64); err == nil && parsed > 0 {
				tailLines = parsed
			}
		}

		opts := &corev1.PodLogOptions{
			Follow:    follow,
			TailLines: &tailLines,
		}
		if container != "" {
			opts.Container = container
		}

		stream, err := client.Clientset.CoreV1().Pods(ns).GetLogs(podName, opts).Stream(r.Context())
		if err != nil {
			http.Error(w, fmt.Sprintf("failed to stream logs: %v", err), http.StatusInternalServerError)
			return
		}
		defer stream.Close()

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming not supported", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("X-Accel-Buffering", "no")

		ctx := r.Context()
		scanner := bufio.NewScanner(stream)

		// Increase scanner buffer for long log lines.
		scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

		for scanner.Scan() {
			select {
			case <-ctx.Done():
				return
			default:
			}
			fmt.Fprintf(w, "data: %s\n\n", scanner.Text())
			flusher.Flush()
		}

		if err := scanner.Err(); err != nil && err != io.EOF && ctx.Err() == nil {
			fmt.Fprintf(w, "event: error\ndata: %s\n\n", err.Error())
			flusher.Flush()
		}

		// Signal stream end for non-follow mode.
		if !follow {
			fmt.Fprintf(w, "event: done\ndata: stream ended\n\n")
			flusher.Flush()
		}
	}
}

func toPodSummary(pod corev1.Pod) PodSummary {
	readyCount := 0
	totalContainers := len(pod.Status.ContainerStatuses)
	var totalRestarts int32
	containers := make([]ContainerInfo, 0, totalContainers)

	for _, cs := range pod.Status.ContainerStatuses {
		totalRestarts += cs.RestartCount
		state := "waiting"
		if cs.State.Running != nil {
			state = "running"
		} else if cs.State.Terminated != nil {
			state = "terminated"
		}
		if cs.Ready {
			readyCount++
		}
		containers = append(containers, ContainerInfo{
			Name:  cs.Name,
			Ready: cs.Ready,
			State: state,
		})
	}

	// Also include init containers.
	for _, cs := range pod.Status.InitContainerStatuses {
		state := "waiting"
		if cs.State.Running != nil {
			state = "running"
		} else if cs.State.Terminated != nil {
			state = "terminated"
		}
		containers = append(containers, ContainerInfo{
			Name:  fmt.Sprintf("init:%s", cs.Name),
			Ready: cs.Ready,
			State: state,
		})
	}

	// Extract ECK component info from labels.
	componentType := pod.Labels["common.k8s.elastic.co/type"]
	componentName := ""
	// ECK uses type-specific labels for the resource name.
	switch componentType {
	case "elasticsearch":
		componentName = pod.Labels["elasticsearch.k8s.elastic.co/cluster-name"]
	case "kibana":
		componentName = pod.Labels["kibana.k8s.elastic.co/name"]
	case "apm":
		componentName = pod.Labels["apm.k8s.elastic.co/name"]
	case "beat":
		componentName = pod.Labels["beat.k8s.elastic.co/name"]
	case "agent":
		componentName = pod.Labels["agent.k8s.elastic.co/name"]
	case "logstash":
		componentName = pod.Labels["logstash.k8s.elastic.co/name"]
	case "enterprise-search":
		componentName = pod.Labels["enterprisesearch.k8s.elastic.co/name"]
	case "maps":
		componentName = pod.Labels["maps.k8s.elastic.co/name"]
	}

	return PodSummary{
		Name:          pod.Name,
		Namespace:     pod.Namespace,
		Phase:         string(pod.Status.Phase),
		Ready:         fmt.Sprintf("%d/%d", readyCount, totalContainers),
		Restarts:      totalRestarts,
		Node:          pod.Spec.NodeName,
		CreatedAt:     pod.CreationTimestamp.Time.Format("2006-01-02T15:04:05Z"),
		Containers:    containers,
		Labels:        pod.Labels,
		ComponentType: componentType,
		ComponentName: componentName,
	}
}
