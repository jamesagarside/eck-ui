package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	corev1 "k8s.io/api/core/v1"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/jamesagarside/eck-ui/pkg/k8s"
)

const (
	versionsConfigMapName = "eck-ui-versions"
	elasticVersionsURL    = "https://artifacts-api.elastic.co/v1/versions"
	apiCacheTTL           = 1 * time.Hour
	apiFetchTimeout       = 5 * time.Second
)

// versionEntry represents a single selectable Stack version.
type versionEntry struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

// versionsResponse is the JSON body returned by GET /api/v1/versions.
type versionsResponse struct {
	OperatorVersion string         `json:"operatorVersion"`
	DefaultVersion  string         `json:"defaultVersion"`
	Versions        []versionEntry `json:"versions"`
	Source          string         `json:"source"`
}

// versionsConfigMapData is the structure stored in the ConfigMap.
type versionsConfigMapData struct {
	DefaultVersion string   `json:"defaultVersion"`
	Versions       []string `json:"versions"`
}

type semver struct {
	Major, Minor, Patch int
}

func parseSemver(v string) semver {
	parts := strings.SplitN(v, ".", 3)
	s := semver{}
	if len(parts) >= 1 {
		s.Major, _ = strconv.Atoi(parts[0])
	}
	if len(parts) >= 2 {
		s.Minor, _ = strconv.Atoi(parts[1])
	}
	if len(parts) >= 3 {
		patchStr := strings.SplitN(parts[2], "-", 2)[0]
		s.Patch, _ = strconv.Atoi(patchStr)
	}
	return s
}

func (s semver) less(o semver) bool {
	if s.Major != o.Major {
		return s.Major < o.Major
	}
	if s.Minor != o.Minor {
		return s.Minor < o.Minor
	}
	return s.Patch < o.Patch
}

// --- API cache ---

type apiCache struct {
	mu        sync.RWMutex
	versions  []string
	fetchedAt time.Time
}

var cache = &apiCache{}

// --- Handlers ---

// VersionsHandler returns a handler that serves available Stack versions.
//
// Resolution order:
//  1. ConfigMap "eck-ui-versions" in the deployment namespace (user-managed)
//  2. Elastic artifacts API (online environments)
//  3. Minimal fallback list
func VersionsHandler(k8sClient *k8s.Client, namespace string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		operatorVersion := detectOperatorVersion(ctx, k8sClient)
		versions, defaultVersion, source := resolveVersions(ctx, k8sClient, namespace)

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		json.NewEncoder(w).Encode(versionsResponse{
			OperatorVersion: operatorVersion,
			DefaultVersion:  defaultVersion,
			Versions:        versions,
			Source:          source,
		})
	}
}

// VersionsUpdateHandler allows updating the versions ConfigMap via PUT /api/v1/versions.
func VersionsUpdateHandler(k8sClient *k8s.Client, namespace string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		var body versionsConfigMapData
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "invalid JSON body"})
			return
		}

		if len(body.Versions) == 0 {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "versions list cannot be empty"})
			return
		}

		if body.DefaultVersion == "" {
			body.DefaultVersion = body.Versions[0]
		}

		data, _ := json.Marshal(body)

		cm := &corev1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{
				Name:      versionsConfigMapName,
				Namespace: namespace,
				Labels: map[string]string{
					"app.kubernetes.io/managed-by": "eck-ui",
					"app.kubernetes.io/component":  "versions",
				},
			},
			Data: map[string]string{
				"versions.json": string(data),
			},
		}

		// Try update first, create if not exists
		_, err := k8sClient.Clientset.CoreV1().ConfigMaps(namespace).Update(ctx, cm, metav1.UpdateOptions{})
		if k8serrors.IsNotFound(err) {
			_, err = k8sClient.Clientset.CoreV1().ConfigMaps(namespace).Create(ctx, cm, metav1.CreateOptions{})
		}

		if err != nil {
			slog.Error("failed to save versions configmap", "error", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": "failed to save versions: " + err.Error()})
			return
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		json.NewEncoder(w).Encode(map[string]string{"status": "saved"})
	}
}

// VersionsSyncHandler fetches versions from the artifacts API and saves them
// to the ConfigMap. Useful for initially populating versions in air-gapped
// environments (run once while connected, then disconnect).
func VersionsSyncHandler(k8sClient *k8s.Client, namespace string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		apiVersions := fetchFromArtifactsAPI(ctx)
		if len(apiVersions) == 0 {
			w.WriteHeader(http.StatusBadGateway)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "unable to reach artifacts API — are you connected to the internet?",
			})
			return
		}

		filtered := filterAndSort(apiVersions)
		if len(filtered) == 0 {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": "no valid versions found"})
			return
		}

		body := versionsConfigMapData{
			DefaultVersion: filtered[0],
			Versions:       filtered,
		}
		data, _ := json.Marshal(body)

		cm := &corev1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{
				Name:      versionsConfigMapName,
				Namespace: namespace,
				Labels: map[string]string{
					"app.kubernetes.io/managed-by": "eck-ui",
					"app.kubernetes.io/component":  "versions",
				},
				Annotations: map[string]string{
					"eck-ui/synced-at": time.Now().UTC().Format(time.RFC3339),
				},
			},
			Data: map[string]string{
				"versions.json": string(data),
			},
		}

		_, err := k8sClient.Clientset.CoreV1().ConfigMaps(namespace).Update(ctx, cm, metav1.UpdateOptions{})
		if k8serrors.IsNotFound(err) {
			_, err = k8sClient.Clientset.CoreV1().ConfigMaps(namespace).Create(ctx, cm, metav1.CreateOptions{})
		}
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": "failed to save: " + err.Error()})
			return
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		json.NewEncoder(w).Encode(map[string]string{
			"status":  "synced",
			"count":   fmt.Sprintf("%d", len(filtered)),
			"default": filtered[0],
		})
	}
}

// --- Resolution logic ---

// resolveVersions tries ConfigMap → artifacts API → fallback.
func resolveVersions(ctx context.Context, k8sClient *k8s.Client, namespace string) ([]versionEntry, string, string) {
	// 1. Try ConfigMap
	if versions, defaultVer, ok := readFromConfigMap(ctx, k8sClient, namespace); ok {
		return versions, defaultVer, "configmap"
	}

	// 2. Try artifacts API
	if apiVersions := fetchFromArtifactsAPI(ctx); len(apiVersions) > 0 {
		filtered := filterAndSort(apiVersions)
		entries := toEntries(filtered)
		if len(entries) > 0 {
			return entries, entries[0].Value, "artifacts-api"
		}
	}

	// 3. Fallback
	fallback := []versionEntry{
		{Value: "9.3.1", Label: "9.3.1"},
		{Value: "8.17.0", Label: "8.17.0"},
		{Value: "7.17.27", Label: "7.17.27 (legacy)"},
	}
	return fallback, fallback[0].Value, "fallback"
}

// readFromConfigMap reads the versions ConfigMap.
func readFromConfigMap(ctx context.Context, k8sClient *k8s.Client, namespace string) ([]versionEntry, string, bool) {
	cm, err := k8sClient.Clientset.CoreV1().ConfigMaps(namespace).Get(ctx, versionsConfigMapName, metav1.GetOptions{})
	if err != nil {
		return nil, "", false
	}

	raw, ok := cm.Data["versions.json"]
	if !ok {
		return nil, "", false
	}

	var data versionsConfigMapData
	if err := json.Unmarshal([]byte(raw), &data); err != nil {
		slog.Warn("invalid versions configmap data", "error", err)
		return nil, "", false
	}

	if len(data.Versions) == 0 {
		return nil, "", false
	}

	entries := toEntries(data.Versions)
	defaultVer := data.DefaultVersion
	if defaultVer == "" {
		defaultVer = entries[0].Value
	}

	return entries, defaultVer, true
}

// --- Artifacts API ---

type artifactsAPIResponse struct {
	Versions []string `json:"versions"`
}

func fetchFromArtifactsAPI(ctx context.Context) []string {
	// Check cache
	cache.mu.RLock()
	if time.Since(cache.fetchedAt) < apiCacheTTL && len(cache.versions) > 0 {
		v := cache.versions
		cache.mu.RUnlock()
		return v
	}
	cache.mu.RUnlock()

	ctx, cancel := context.WithTimeout(ctx, apiFetchTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, elasticVersionsURL, nil)
	if err != nil {
		return nil
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		slog.Debug("artifacts API unavailable", "error", err)
		return nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil
	}

	var apiResp artifactsAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil
	}

	cache.mu.Lock()
	cache.versions = apiResp.Versions
	cache.fetchedAt = time.Now()
	cache.mu.Unlock()

	return apiResp.Versions
}

// --- Helpers ---

// filterAndSort removes snapshots, versions below 7.17, and sorts descending.
func filterAndSort(versions []string) []string {
	var result []string
	for _, v := range versions {
		if strings.Contains(v, "SNAPSHOT") {
			continue
		}
		sv := parseSemver(v)
		if sv.Major < 7 {
			continue
		}
		if sv.Major == 7 && sv.Minor < 17 {
			continue
		}
		result = append(result, v)
	}

	sort.Slice(result, func(i, j int) bool {
		a := parseSemver(result[i])
		b := parseSemver(result[j])
		return b.less(a)
	})

	return result
}

// toEntries converts version strings to versionEntry with labels.
func toEntries(versions []string) []versionEntry {
	entries := make([]versionEntry, 0, len(versions))
	for _, v := range versions {
		label := v
		sv := parseSemver(v)
		if sv.Major == 7 {
			label = fmt.Sprintf("%s (legacy)", v)
		}
		entries = append(entries, versionEntry{Value: v, Label: label})
	}
	return entries
}

// --- Operator detection ---

func detectOperatorVersion(ctx context.Context, k8sClient *k8s.Client) string {
	namespaces := []string{"elastic-system", "kube-system", "default"}

	for _, ns := range namespaces {
		// ConfigMap (cheapest, always present)
		cm, err := k8sClient.Clientset.CoreV1().ConfigMaps(ns).Get(ctx, "elastic-operator", metav1.GetOptions{})
		if err == nil {
			if v, ok := cm.Labels["app.kubernetes.io/version"]; ok && v != "" {
				return v
			}
		}

		// StatefulSet (ECK 2.x+)
		statefulSets, err := k8sClient.Clientset.AppsV1().StatefulSets(ns).List(ctx, metav1.ListOptions{
			LabelSelector: "control-plane=elastic-operator",
		})
		if err == nil {
			for _, ss := range statefulSets.Items {
				if v := extractVersion(ss.Labels, ss.Spec.Template.Spec.Containers); v != "" {
					return v
				}
			}
		}

		// Deployment (older installs)
		deployments, err := k8sClient.Clientset.AppsV1().Deployments(ns).List(ctx, metav1.ListOptions{
			LabelSelector: "control-plane=elastic-operator",
		})
		if err == nil {
			for _, dep := range deployments.Items {
				if v := extractVersion(dep.Labels, dep.Spec.Template.Spec.Containers); v != "" {
					return v
				}
			}
		}
	}

	return ""
}

func extractVersion(labels map[string]string, containers []corev1.Container) string {
	if v, ok := labels["app.kubernetes.io/version"]; ok && v != "" {
		return v
	}
	for _, c := range containers {
		if parts := strings.SplitN(c.Image, ":", 2); len(parts) == 2 {
			return parts[1]
		}
	}
	return ""
}
