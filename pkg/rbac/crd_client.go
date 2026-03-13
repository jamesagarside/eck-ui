package rbac

import (
	"context"
	"encoding/json"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
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

// Create creates a new ECKUIRoleBinding resource in the cluster.
func (c *CRDClient) Create(ctx context.Context, binding *ECKUIRoleBinding) (*ECKUIRoleBinding, error) {
	// Ensure TypeMeta is set correctly.
	binding.APIVersion = Group + "/" + Version
	binding.Kind = Kind

	data, err := json.Marshal(binding)
	if err != nil {
		return nil, fmt.Errorf("marshalling ECKUIRoleBinding: %w", err)
	}

	obj := &unstructured.Unstructured{}
	if err := json.Unmarshal(data, &obj.Object); err != nil {
		return nil, fmt.Errorf("converting ECKUIRoleBinding to unstructured: %w", err)
	}

	created, err := c.client.Resource(gvr).Create(ctx, obj, metav1.CreateOptions{})
	if err != nil {
		return nil, fmt.Errorf("creating ECKUIRoleBinding: %w", err)
	}

	resultData, err := json.Marshal(created.Object)
	if err != nil {
		return nil, fmt.Errorf("marshalling created ECKUIRoleBinding: %w", err)
	}

	var result ECKUIRoleBinding
	if err := json.Unmarshal(resultData, &result); err != nil {
		return nil, fmt.Errorf("unmarshalling created ECKUIRoleBinding: %w", err)
	}

	return &result, nil
}

// Delete removes an ECKUIRoleBinding resource by name from the cluster.
func (c *CRDClient) Delete(ctx context.Context, name string) error {
	if err := c.client.Resource(gvr).Delete(ctx, name, metav1.DeleteOptions{}); err != nil {
		return fmt.Errorf("deleting ECKUIRoleBinding %q: %w", name, err)
	}
	return nil
}
