package handlers

import (
	"context"
	"net/http"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/jamesagarside/eck-ui/pkg/k8s"
)

// Version is set at build time via ldflags.
var Version = "dev"

// SystemInfoResponse is the API response for GET /api/v1/system-info.
type SystemInfoResponse struct {
	UIVersion       string            `json:"uiVersion"`
	K8sVersion      string            `json:"k8sVersion"`
	OperatorVersion string            `json:"operatorVersion"`
	CRDVersions     map[string]string `json:"crdVersions"`
}

// crdGVR is the GVR for CustomResourceDefinition objects.
var crdGVR = schema.GroupVersionResource{
	Group:    "apiextensions.k8s.io",
	Version:  "v1",
	Resource: "customresourcedefinitions",
}

// eckGroups lists the API groups owned by the ECK operator.
var eckGroups = map[string]bool{
	"elasticsearch.k8s.elastic.co":     true,
	"kibana.k8s.elastic.co":            true,
	"apm.k8s.elastic.co":              true,
	"beat.k8s.elastic.co":             true,
	"agent.k8s.elastic.co":            true,
	"logstash.k8s.elastic.co":         true,
	"enterprisesearch.k8s.elastic.co": true,
	"maps.k8s.elastic.co":            true,
	"autoscaling.k8s.elastic.co":     true,
	"stackconfigpolicy.k8s.elastic.co": true,
}

// SystemInfoHandler returns the GET /api/v1/system-info handler.
func SystemInfoHandler(k8sClient *k8s.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		resp := SystemInfoResponse{
			UIVersion:   Version,
			CRDVersions: make(map[string]string),
		}

		// K8s server version
		if info, err := k8sClient.Clientset.Discovery().ServerVersion(); err == nil {
			resp.K8sVersion = info.GitVersion
		}

		// ECK operator version — look for the operator as Deployment or StatefulSet
		operatorNS := "elastic-system"
		var operatorContainers []corev1.Container
		if deploy, err := k8sClient.Clientset.AppsV1().Deployments(operatorNS).Get(ctx, "elastic-operator", metav1.GetOptions{}); err == nil {
			operatorContainers = deploy.Spec.Template.Spec.Containers
		} else if sts, err := k8sClient.Clientset.AppsV1().StatefulSets(operatorNS).Get(ctx, "elastic-operator", metav1.GetOptions{}); err == nil {
			operatorContainers = sts.Spec.Template.Spec.Containers
		}
		for _, c := range operatorContainers {
			if c.Name == "manager" {
				resp.OperatorVersion = c.Image
				break
			}
		}
		if resp.OperatorVersion == "" && len(operatorContainers) > 0 {
			resp.OperatorVersion = operatorContainers[0].Image
		}

		// ECK CRD versions via dynamic client
		if crdList, err := k8sClient.Dynamic.Resource(crdGVR).List(ctx, metav1.ListOptions{}); err == nil {
			for _, item := range crdList.Items {
				spec, _ := item.Object["spec"].(map[string]interface{})
				if spec == nil {
					continue
				}
				group, _ := spec["group"].(string)
				if !eckGroups[group] {
					continue
				}
				name := item.GetName()
				versions, _ := spec["versions"].([]interface{})
				for _, v := range versions {
					vm, _ := v.(map[string]interface{})
					if vm == nil {
						continue
					}
					served, _ := vm["served"].(bool)
					if served {
						vName, _ := vm["name"].(string)
						resp.CRDVersions[name] = vName
						break
					}
				}
			}
		}

		writeJSON(w, http.StatusOK, resp)
	}
}
