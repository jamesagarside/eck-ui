package handlers

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/jamesagarside/eck-ui/pkg/clusters"
	apierrors "github.com/jamesagarside/eck-ui/pkg/errors"
	"github.com/jamesagarside/eck-ui/pkg/middleware"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
)

// clusterResponse is the JSON representation of a cluster for API responses.
type clusterResponse struct {
	Name        string                      `json:"name"`
	Namespace   string                      `json:"namespace"`
	DisplayName string                      `json:"displayName,omitempty"`
	Spec        clusterSpecResponse         `json:"spec"`
	Status      clusters.ECKUIClusterStatus `json:"status"`
}

type clusterSpecResponse struct {
	APIServerURL   string                        `json:"apiServerURL"`
	DisplayName    string                        `json:"displayName,omitempty"`
	AllowedGroups  []string                      `json:"allowedGroups,omitempty"`
	HealthCheck    clusters.HealthCheckConfig     `json:"healthCheck,omitempty"`
	CircuitBreaker clusters.CircuitBreakerConfig  `json:"circuitBreaker,omitempty"`
}

type clusterListResponse struct {
	Items             []clusterResponse `json:"items"`
	SingleClusterMode bool              `json:"singleClusterMode"`
}

func toClusterResponse(c *clusters.ECKUICluster) clusterResponse {
	displayName := c.Spec.DisplayName
	if displayName == "" {
		displayName = c.Name
	}
	return clusterResponse{
		Name:        c.Name,
		Namespace:   c.Namespace,
		DisplayName: displayName,
		Spec: clusterSpecResponse{
			APIServerURL:   c.Spec.APIServerURL,
			DisplayName:    c.Spec.DisplayName,
			AllowedGroups:  c.Spec.AllowedGroups,
			HealthCheck:    c.Spec.HealthCheck,
			CircuitBreaker: c.Spec.CircuitBreaker,
		},
		Status: c.Status,
	}
}

// ListClustersHandler returns all registered clusters the user has access to.
func ListClustersHandler(manager *clusters.ClusterManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userInfo := middleware.UserInfoFromContext(r.Context())
		if userInfo == nil {
			apierrors.WriteError(w, apierrors.ErrUnauthorized)
			return
		}

		all := manager.ListClusters()
		var items []clusterResponse
		for _, c := range all {
			if isGroupAllowed(userInfo.Groups, c.Spec.AllowedGroups) {
				items = append(items, toClusterResponse(c))
			}
		}

		if items == nil {
			items = []clusterResponse{}
		}

		writeJSON(w, http.StatusOK, clusterListResponse{
			Items:             items,
			SingleClusterMode: false,
		})
	}
}

// GetClusterHandler returns details for a single cluster.
func GetClusterHandler(manager *clusters.ClusterManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		clusterID := mux.Vars(r)["cluster"]

		cluster := manager.GetCluster(clusterID)
		if cluster == nil {
			apierrors.WriteError(w, apierrors.New(
				http.StatusNotFound,
				"NotFound",
				fmt.Sprintf("cluster %q is not registered", clusterID),
			))
			return
		}

		userInfo := middleware.UserInfoFromContext(r.Context())
		if !isGroupAllowed(userInfo.Groups, cluster.Spec.AllowedGroups) {
			apierrors.WriteError(w, apierrors.New(
				http.StatusForbidden,
				"Forbidden",
				fmt.Sprintf("you do not have access to cluster %q", clusterID),
			))
			return
		}

		writeJSON(w, http.StatusOK, toClusterResponse(cluster))
	}
}

type createClusterRequest struct {
	Name            string                        `json:"name"`
	Namespace       string                        `json:"namespace"`
	APIServerURL    string                        `json:"apiServerURL"`
	CABundle        string                        `json:"caBundle,omitempty"`
	DisplayName     string                        `json:"displayName,omitempty"`
	AllowedGroups   []string                      `json:"allowedGroups,omitempty"`
	HealthCheck     clusters.HealthCheckConfig     `json:"healthCheck,omitempty"`
	CircuitBreaker  clusters.CircuitBreakerConfig  `json:"circuitBreaker,omitempty"`
	CredentialType  string                        `json:"credentialType"`
	CredentialValue string                        `json:"credentialValue"`
}

// CreateClusterHandler creates a new ECKUICluster CR and its credential Secret.
func CreateClusterHandler(dynamicClient dynamic.Interface, clientset kubernetes.Interface) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		role := middleware.RoleFromContext(r.Context())
		if role != "admin" {
			apierrors.WriteError(w, apierrors.New(
				http.StatusForbidden,
				"Forbidden",
				"only platform admins can register clusters",
			))
			return
		}

		var req createClusterRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			apierrors.WriteError(w, apierrors.New(
				http.StatusBadRequest,
				"BadRequest",
				"invalid request body: "+err.Error(),
			))
			return
		}

		if req.Name == "" || req.APIServerURL == "" || req.CredentialType == "" || req.CredentialValue == "" {
			apierrors.WriteError(w, apierrors.New(
				http.StatusBadRequest,
				"BadRequest",
				"name, apiServerURL, credentialType, and credentialValue are required",
			))
			return
		}

		if req.Namespace == "" {
			req.Namespace = "eck-ui-system"
		}

		secretName := "cluster-" + req.Name + "-credentials"

		secretData := map[string][]byte{}
		if req.CredentialType == "token" {
			secretData["token"] = []byte(req.CredentialValue)
		} else if req.CredentialType == "kubeconfig" {
			secretData["kubeconfig"] = []byte(req.CredentialValue)
		} else {
			apierrors.WriteError(w, apierrors.New(
				http.StatusBadRequest,
				"BadRequest",
				"credentialType must be 'token' or 'kubeconfig'",
			))
			return
		}

		secret := &corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{
				Name:      secretName,
				Namespace: req.Namespace,
			},
			Type: corev1.SecretTypeOpaque,
			Data: secretData,
		}

		_, err := clientset.CoreV1().Secrets(req.Namespace).Create(r.Context(), secret, metav1.CreateOptions{})
		if err != nil {
			apierrors.WriteError(w, apierrors.New(
				http.StatusInternalServerError,
				"InternalError",
				"failed to create credential secret: "+err.Error(),
			))
			return
		}

		cluster := &clusters.ECKUICluster{
			Name:      req.Name,
			Namespace: req.Namespace,
			Spec: clusters.ECKUIClusterSpec{
				APIServerURL: req.APIServerURL,
				CABundle:     req.CABundle,
				DisplayName:  req.DisplayName,
				CredentialSecretRef: clusters.CredentialSecretRef{
					Name:      secretName,
					Namespace: req.Namespace,
				},
				AllowedGroups:  req.AllowedGroups,
				HealthCheck:    req.HealthCheck,
				CircuitBreaker: req.CircuitBreaker,
			},
		}

		obj := clusters.ToUnstructured(cluster)
		_, err = dynamicClient.Resource(clusters.GVR).Namespace(req.Namespace).Create(
			r.Context(), obj, metav1.CreateOptions{},
		)
		if err != nil {
			_ = clientset.CoreV1().Secrets(req.Namespace).Delete(r.Context(), secretName, metav1.DeleteOptions{})
			apierrors.WriteError(w, apierrors.FromK8sError(err))
			return
		}

		slog.Info("cluster registered", "name", req.Name, "namespace", req.Namespace)
		writeJSON(w, http.StatusCreated, toClusterResponse(cluster))
	}
}

// UpdateClusterHandler updates an existing ECKUICluster CR.
func UpdateClusterHandler(dynamicClient dynamic.Interface) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		role := middleware.RoleFromContext(r.Context())
		if role != "admin" {
			apierrors.WriteError(w, apierrors.New(
				http.StatusForbidden,
				"Forbidden",
				"only platform admins can update clusters",
			))
			return
		}

		clusterID := mux.Vars(r)["cluster"]

		var req createClusterRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			apierrors.WriteError(w, apierrors.New(
				http.StatusBadRequest,
				"BadRequest",
				"invalid request body: "+err.Error(),
			))
			return
		}

		list, err := dynamicClient.Resource(clusters.GVR).Namespace("").List(r.Context(), metav1.ListOptions{})
		if err != nil {
			apierrors.WriteError(w, apierrors.FromK8sError(err))
			return
		}

		var found *unstructured.Unstructured
		for i := range list.Items {
			if list.Items[i].GetName() == clusterID {
				found = &list.Items[i]
				break
			}
		}

		if found == nil {
			apierrors.WriteError(w, apierrors.New(
				http.StatusNotFound,
				"NotFound",
				fmt.Sprintf("cluster %q not found", clusterID),
			))
			return
		}

		spec, _ := found.Object["spec"].(map[string]interface{})
		if req.DisplayName != "" {
			spec["displayName"] = req.DisplayName
		}
		if req.APIServerURL != "" {
			spec["apiServerURL"] = req.APIServerURL
		}
		if req.AllowedGroups != nil {
			groups := make([]interface{}, len(req.AllowedGroups))
			for i, g := range req.AllowedGroups {
				groups[i] = g
			}
			spec["allowedGroups"] = groups
		}

		_, err = dynamicClient.Resource(clusters.GVR).Namespace(found.GetNamespace()).Update(
			r.Context(), found, metav1.UpdateOptions{},
		)
		if err != nil {
			apierrors.WriteError(w, apierrors.FromK8sError(err))
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{"status": "updated", "name": clusterID})
	}
}

// DeleteClusterHandler deregisters a cluster and optionally deletes its credential Secret.
func DeleteClusterHandler(dynamicClient dynamic.Interface, clientset kubernetes.Interface) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		role := middleware.RoleFromContext(r.Context())
		if role != "admin" {
			apierrors.WriteError(w, apierrors.New(
				http.StatusForbidden,
				"Forbidden",
				"only platform admins can delete clusters",
			))
			return
		}

		clusterID := mux.Vars(r)["cluster"]
		deleteCredentials := r.URL.Query().Get("deleteCredentials") == "true"

		list, err := dynamicClient.Resource(clusters.GVR).Namespace("").List(r.Context(), metav1.ListOptions{})
		if err != nil {
			apierrors.WriteError(w, apierrors.FromK8sError(err))
			return
		}

		var clusterObj *clusters.ECKUICluster
		var ns string
		for i := range list.Items {
			if list.Items[i].GetName() == clusterID {
				clusterObj, _ = clusters.FromUnstructured(&list.Items[i])
				ns = list.Items[i].GetNamespace()
				break
			}
		}

		if clusterObj == nil {
			apierrors.WriteError(w, apierrors.New(
				http.StatusNotFound,
				"NotFound",
				fmt.Sprintf("cluster %q not found", clusterID),
			))
			return
		}

		if err := dynamicClient.Resource(clusters.GVR).Namespace(ns).Delete(
			r.Context(), clusterID, metav1.DeleteOptions{},
		); err != nil {
			apierrors.WriteError(w, apierrors.FromK8sError(err))
			return
		}

		if deleteCredentials && clusterObj.Spec.CredentialSecretRef.Name != "" {
			if err := clientset.CoreV1().Secrets(clusterObj.Spec.CredentialSecretRef.Namespace).Delete(
				r.Context(), clusterObj.Spec.CredentialSecretRef.Name, metav1.DeleteOptions{},
			); err != nil {
				slog.Warn("failed to delete credential secret", "cluster", clusterID, "error", err)
			}
		}

		slog.Info("cluster deregistered", "name", clusterID)
		writeJSON(w, http.StatusOK, map[string]string{"status": "deleted", "name": clusterID})
	}
}

// HealthCheckClusterHandler returns health status for a specific cluster.
func HealthCheckClusterHandler(manager *clusters.ClusterManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		clusterID := mux.Vars(r)["cluster"]

		cluster := manager.GetCluster(clusterID)
		if cluster == nil {
			apierrors.WriteError(w, apierrors.New(
				http.StatusNotFound,
				"NotFound",
				fmt.Sprintf("cluster %q is not registered", clusterID),
			))
			return
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"name":      clusterID,
			"phase":     cluster.Status.Phase,
			"lastCheck": cluster.Status.LastHealthCheck,
			"error":     cluster.Status.LastError,
		})
	}
}

// SingleClusterModeHandler returns a 404 indicating multi-cluster mode is not enabled.
func SingleClusterModeHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		apierrors.WriteError(w, apierrors.New(
			http.StatusNotFound,
			"NotFound",
			"multi-cluster mode is not enabled",
		))
	}
}

func isGroupAllowed(userGroups, allowedGroups []string) bool {
	if len(allowedGroups) == 0 {
		return true
	}
	allowed := make(map[string]bool, len(allowedGroups))
	for _, g := range allowedGroups {
		allowed[g] = true
	}
	for _, g := range userGroups {
		if allowed[g] {
			return true
		}
	}
	return false
}
