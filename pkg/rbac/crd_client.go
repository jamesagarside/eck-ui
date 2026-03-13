package rbac

import (
	"context"
	"encoding/json"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
)

var gvr = schema.GroupVersionResource{
	Group:    Group,
	Version:  Version,
	Resource: Resource,
}

// CRDClient provides access to ECKUIRoleBinding custom resources.
type CRDClient struct {
	client dynamic.Interface
}

// NewCRDClient creates a new CRDClient.
func NewCRDClient(client dynamic.Interface) *CRDClient {
	return &CRDClient{client: client}
}

// List returns all ECKUIRoleBinding resources in the cluster.
func (c *CRDClient) List(ctx context.Context) ([]ECKUIRoleBinding, error) {
	list, err := c.client.Resource(gvr).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("listing ECKUIRoleBindings: %w", err)
	}

	var bindings []ECKUIRoleBinding
	for _, item := range list.Items {
		data, err := json.Marshal(item.Object)
		if err != nil {
			return nil, fmt.Errorf("marshalling ECKUIRoleBinding: %w", err)
		}
		var rb ECKUIRoleBinding
		if err := json.Unmarshal(data, &rb); err != nil {
			return nil, fmt.Errorf("unmarshalling ECKUIRoleBinding: %w", err)
		}
		bindings = append(bindings, rb)
	}

	return bindings, nil
}
