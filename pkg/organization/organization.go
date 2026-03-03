// Package organization provides organization management functionality.
package organization

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"

	"github.com/jamesagarside/eck-ui/pkg/k8s"
)

const (
	// ConfigMapPrefix is the prefix for organization ConfigMaps.
	ConfigMapPrefix = "eck-ui-org-"
	// LabelOrganization is the label key for organization ConfigMaps.
	LabelOrganization = "eck-ui.elastic.co/organization"
	// LabelManagedBy is the label indicating management by ECK UI.
	LabelManagedBy = "app.kubernetes.io/managed-by"
	// AnnotationDescription stores the organization description.
	AnnotationDescription = "eck-ui.elastic.co/description"
	// DataKeyMembers is the ConfigMap key for member data.
	DataKeyMembers = "members"
	// DataKeySettings is the ConfigMap key for org settings.
	DataKeySettings = "settings"
)

// Organization represents an ECK UI organization.
type Organization struct {
	// Name is the organization identifier (matches namespace).
	Name string `json:"name"`
	// DisplayName is the human-readable name.
	DisplayName string `json:"display_name,omitempty"`
	// Description is the organization description.
	Description string `json:"description,omitempty"`
	// Namespace is the Kubernetes namespace for this org.
	Namespace string `json:"namespace"`
	// CreatedAt is when the organization was created.
	CreatedAt time.Time `json:"created_at,omitempty"`
	// UpdatedAt is when the organization was last updated.
	UpdatedAt time.Time `json:"updated_at,omitempty"`
}

// Member represents an organization member.
type Member struct {
	// UserID is the unique user identifier (from OIDC sub claim or K8s username).
	UserID string `json:"user_id"`
	// Email is the user's email address.
	Email string `json:"email,omitempty"`
	// Role is the user's role within the organization.
	Role Role `json:"role"`
	// AddedAt is when the member was added.
	AddedAt time.Time `json:"added_at,omitempty"`
}

// Role represents a user's role within an organization.
type Role string

const (
	// RoleViewer can view resources but not modify them.
	RoleViewer Role = "viewer"
	// RoleEditor can view and modify resources.
	RoleEditor Role = "editor"
	// RoleAdmin can manage the organization and its members.
	RoleAdmin Role = "admin"
)

// Permission represents an action that can be performed.
type Permission string

const (
	PermissionRead   Permission = "read"
	PermissionCreate Permission = "create"
	PermissionUpdate Permission = "update"
	PermissionDelete Permission = "delete"
	PermissionAdmin  Permission = "admin"
)

// RolePermissions maps roles to their permissions.
var RolePermissions = map[Role][]Permission{
	RoleViewer: {PermissionRead},
	RoleEditor: {PermissionRead, PermissionCreate, PermissionUpdate, PermissionDelete},
	RoleAdmin:  {PermissionRead, PermissionCreate, PermissionUpdate, PermissionDelete, PermissionAdmin},
}

// HasPermission checks if a role has a specific permission.
func (r Role) HasPermission(p Permission) bool {
	perms, ok := RolePermissions[r]
	if !ok {
		return false
	}
	for _, perm := range perms {
		if perm == p {
			return true
		}
	}
	return false
}

// Service provides organization management operations.
type Service struct {
	client          kubernetes.Interface
	systemNamespace string
}

// NewService creates a new organization service.
func NewService(systemNamespace string) (*Service, error) {
	k8sClient, err := k8s.NewClient()
	if err != nil {
		return nil, err
	}
	return &Service{
		client:          k8sClient.Clientset,
		systemNamespace: systemNamespace,
	}, nil
}

// configMapName returns the ConfigMap name for an organization.
func configMapName(orgName string) string {
	return ConfigMapPrefix + orgName
}

// List returns all organizations.
func (s *Service) List(ctx context.Context) ([]Organization, error) {
	// List namespaces that have organization ConfigMaps
	configMaps, err := s.client.CoreV1().ConfigMaps(s.systemNamespace).List(ctx, metav1.ListOptions{
		LabelSelector: fmt.Sprintf("%s=%s", LabelManagedBy, "eck-ui"),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list organization configmaps: %w", err)
	}

	orgs := make([]Organization, 0, len(configMaps.Items))
	for _, cm := range configMaps.Items {
		org := configMapToOrg(&cm)
		orgs = append(orgs, org)
	}

	return orgs, nil
}

// Get returns a specific organization.
func (s *Service) Get(ctx context.Context, name string) (*Organization, error) {
	cm, err := s.client.CoreV1().ConfigMaps(s.systemNamespace).Get(ctx, configMapName(name), metav1.GetOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil, fmt.Errorf("organization not found: %s", name)
		}
		return nil, fmt.Errorf("failed to get organization: %w", err)
	}

	org := configMapToOrg(cm)
	return &org, nil
}

// Create creates a new organization.
func (s *Service) Create(ctx context.Context, org *Organization) (*Organization, error) {
	// First, ensure the namespace exists
	ns := &corev1.Namespace{
		ObjectMeta: metav1.ObjectMeta{
			Name: org.Namespace,
			Labels: map[string]string{
				LabelOrganization: org.Name,
				LabelManagedBy:    "eck-ui",
			},
		},
	}
	_, err := s.client.CoreV1().Namespaces().Create(ctx, ns, metav1.CreateOptions{})
	if err != nil && !apierrors.IsAlreadyExists(err) {
		return nil, fmt.Errorf("failed to create namespace: %w", err)
	}

	// Create the organization ConfigMap
	now := time.Now().UTC()
	org.CreatedAt = now
	org.UpdatedAt = now

	cm := orgToConfigMap(org, s.systemNamespace)
	created, err := s.client.CoreV1().ConfigMaps(s.systemNamespace).Create(ctx, cm, metav1.CreateOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to create organization configmap: %w", err)
	}

	result := configMapToOrg(created)
	return &result, nil
}

// Update updates an existing organization.
func (s *Service) Update(ctx context.Context, org *Organization) (*Organization, error) {
	org.UpdatedAt = time.Now().UTC()
	cm := orgToConfigMap(org, s.systemNamespace)

	updated, err := s.client.CoreV1().ConfigMaps(s.systemNamespace).Update(ctx, cm, metav1.UpdateOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to update organization: %w", err)
	}

	result := configMapToOrg(updated)
	return &result, nil
}

// Delete deletes an organization.
func (s *Service) Delete(ctx context.Context, name string) error {
	// Delete the ConfigMap
	err := s.client.CoreV1().ConfigMaps(s.systemNamespace).Delete(ctx, configMapName(name), metav1.DeleteOptions{})
	if err != nil && !apierrors.IsNotFound(err) {
		return fmt.Errorf("failed to delete organization configmap: %w", err)
	}

	// Note: We don't delete the namespace automatically as it may contain resources
	return nil
}

// GetMembers returns all members of an organization.
func (s *Service) GetMembers(ctx context.Context, orgName string) ([]Member, error) {
	cm, err := s.client.CoreV1().ConfigMaps(s.systemNamespace).Get(ctx, configMapName(orgName), metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get organization: %w", err)
	}

	membersJSON, ok := cm.Data[DataKeyMembers]
	if !ok {
		return []Member{}, nil
	}

	var members []Member
	if err := json.Unmarshal([]byte(membersJSON), &members); err != nil {
		return nil, fmt.Errorf("failed to parse members: %w", err)
	}

	return members, nil
}

// AddMember adds a member to an organization.
func (s *Service) AddMember(ctx context.Context, orgName string, member Member) error {
	members, err := s.GetMembers(ctx, orgName)
	if err != nil {
		return err
	}

	// Check if member already exists
	for _, m := range members {
		if m.UserID == member.UserID {
			return fmt.Errorf("member already exists: %s", member.UserID)
		}
	}

	member.AddedAt = time.Now().UTC()
	members = append(members, member)

	return s.updateMembers(ctx, orgName, members)
}

// RemoveMember removes a member from an organization.
func (s *Service) RemoveMember(ctx context.Context, orgName, userID string) error {
	members, err := s.GetMembers(ctx, orgName)
	if err != nil {
		return err
	}

	newMembers := make([]Member, 0, len(members))
	found := false
	for _, m := range members {
		if m.UserID != userID {
			newMembers = append(newMembers, m)
		} else {
			found = true
		}
	}

	if !found {
		return fmt.Errorf("member not found: %s", userID)
	}

	return s.updateMembers(ctx, orgName, newMembers)
}

// UpdateMemberRole updates a member's role.
func (s *Service) UpdateMemberRole(ctx context.Context, orgName, userID string, role Role) error {
	members, err := s.GetMembers(ctx, orgName)
	if err != nil {
		return err
	}

	found := false
	for i := range members {
		if members[i].UserID == userID {
			members[i].Role = role
			found = true
			break
		}
	}

	if !found {
		return fmt.Errorf("member not found: %s", userID)
	}

	return s.updateMembers(ctx, orgName, members)
}

// GetMemberRole returns a user's role in an organization.
func (s *Service) GetMemberRole(ctx context.Context, orgName, userID string) (Role, error) {
	members, err := s.GetMembers(ctx, orgName)
	if err != nil {
		return "", err
	}

	for _, m := range members {
		if m.UserID == userID {
			return m.Role, nil
		}
	}

	return "", fmt.Errorf("member not found: %s", userID)
}

// IsMember checks if a user is a member of an organization.
func (s *Service) IsMember(ctx context.Context, orgName, userID string) (bool, error) {
	members, err := s.GetMembers(ctx, orgName)
	if err != nil {
		return false, err
	}

	for _, m := range members {
		if m.UserID == userID {
			return true, nil
		}
	}

	return false, nil
}

// updateMembers updates the members list in the ConfigMap.
func (s *Service) updateMembers(ctx context.Context, orgName string, members []Member) error {
	cm, err := s.client.CoreV1().ConfigMaps(s.systemNamespace).Get(ctx, configMapName(orgName), metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("failed to get organization: %w", err)
	}

	membersJSON, err := json.Marshal(members)
	if err != nil {
		return fmt.Errorf("failed to marshal members: %w", err)
	}

	if cm.Data == nil {
		cm.Data = make(map[string]string)
	}
	cm.Data[DataKeyMembers] = string(membersJSON)

	_, err = s.client.CoreV1().ConfigMaps(s.systemNamespace).Update(ctx, cm, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("failed to update members: %w", err)
	}

	return nil
}

// configMapToOrg converts a ConfigMap to an Organization.
func configMapToOrg(cm *corev1.ConfigMap) Organization {
	org := Organization{
		Name:      cm.Labels[LabelOrganization],
		Namespace: cm.Labels[LabelOrganization], // Namespace == org name
	}

	if displayName, ok := cm.Data["display_name"]; ok {
		org.DisplayName = displayName
	}
	if desc, ok := cm.Annotations[AnnotationDescription]; ok {
		org.Description = desc
	}

	org.CreatedAt = cm.CreationTimestamp.Time
	org.UpdatedAt = cm.CreationTimestamp.Time

	return org
}

// orgToConfigMap converts an Organization to a ConfigMap.
func orgToConfigMap(org *Organization, namespace string) *corev1.ConfigMap {
	return &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      configMapName(org.Name),
			Namespace: namespace,
			Labels: map[string]string{
				LabelOrganization: org.Name,
				LabelManagedBy:    "eck-ui",
			},
			Annotations: map[string]string{
				AnnotationDescription: org.Description,
			},
		},
		Data: map[string]string{
			"display_name": org.DisplayName,
		},
	}
}
