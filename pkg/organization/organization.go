package organization

import (
	"context"
	"fmt"
	"sync"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// Role defines the permission level for an organization member.
type Role string

const (
	RoleAdmin  Role = "admin"
	RoleEditor Role = "editor"
	RoleViewer Role = "viewer"
)

// Org represents an organizational unit that groups namespaces and members.
type Org struct {
	Name        string      `json:"name"`
	DisplayName string      `json:"displayName"`
	Namespaces  []string    `json:"namespaces"`
	Members     []OrgMember `json:"members"`
}

// OrgMember represents a user's membership and role within an organization.
type OrgMember struct {
	Username string `json:"username"`
	Role     Role   `json:"role"`
}

// Store provides in-memory organization storage with methods to load from
// Kubernetes ConfigMaps.
type Store struct {
	mu   sync.RWMutex
	orgs map[string]*Org
}

// NewStore creates a new empty organization store.
func NewStore() *Store {
	return &Store{
		orgs: make(map[string]*Org),
	}
}

// ListOrganizations returns all organizations in the store.
func (s *Store) ListOrganizations() []*Org {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]*Org, 0, len(s.orgs))
	for _, org := range s.orgs {
		result = append(result, org)
	}
	return result
}

// GetOrganization returns a single organization by name, or an error if not found.
func (s *Store) GetOrganization(name string) (*Org, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	org, ok := s.orgs[name]
	if !ok {
		return nil, fmt.Errorf("organization %q not found", name)
	}
	return org, nil
}

// GetUserOrganizations returns all organizations where the given username is a member.
func (s *Store) GetUserOrganizations(username string) []*Org {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*Org
	for _, org := range s.orgs {
		for _, member := range org.Members {
			if member.Username == username {
				result = append(result, org)
				break
			}
		}
	}
	return result
}

// AddOrganization adds or replaces an organization in the store.
func (s *Store) AddOrganization(org *Org) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.orgs[org.Name] = org
}

// DeleteOrganization removes an organization from the store by name.
func (s *Store) DeleteOrganization(name string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.orgs, name)
}

// GetUserRole returns the role for a user within an organization.
// Returns an empty Role and false if the user is not a member.
func (s *Store) GetUserRole(orgName, username string) (Role, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	org, ok := s.orgs[orgName]
	if !ok {
		return "", false
	}
	for _, member := range org.Members {
		if member.Username == username {
			return member.Role, true
		}
	}
	return "", false
}

// LoadFromConfigMaps loads organization definitions from Kubernetes ConfigMaps
// in the specified namespace. ConfigMaps must be labeled with
// "app.kubernetes.io/managed-by=eck-ui" and have the following data keys:
//   - displayName: human-readable organization name
//   - namespaces: comma-separated list of namespace names
//   - members: comma-separated list of "username:role" pairs
func (s *Store) LoadFromConfigMaps(ctx context.Context, clientset kubernetes.Interface, namespace string) error {
	cms, err := clientset.CoreV1().ConfigMaps(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: "app.kubernetes.io/managed-by=eck-ui,eck-ui.elastic.co/type=organization",
	})
	if err != nil {
		return fmt.Errorf("listing organization configmaps: %w", err)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	for _, cm := range cms.Items {
		org := &Org{
			Name:        cm.Name,
			DisplayName: cm.Data["displayName"],
		}

		if ns, ok := cm.Data["namespaces"]; ok && ns != "" {
			org.Namespaces = splitAndTrim(ns)
		}

		if members, ok := cm.Data["members"]; ok && members != "" {
			for _, entry := range splitAndTrim(members) {
				parts := splitAndTrim(entry)
				if len(parts) == 1 {
					// Try splitting on colon for "username:role" format.
					colonParts := splitOnColon(entry)
					if len(colonParts) == 2 {
						org.Members = append(org.Members, OrgMember{
							Username: colonParts[0],
							Role:     Role(colonParts[1]),
						})
					}
				}
			}
		}

		s.orgs[org.Name] = org
	}

	return nil
}

// splitAndTrim splits a string by comma and trims whitespace from each element.
func splitAndTrim(s string) []string {
	var result []string
	start := 0
	for i := 0; i <= len(s); i++ {
		if i == len(s) || s[i] == ',' {
			part := trimSpace(s[start:i])
			if part != "" {
				result = append(result, part)
			}
			start = i + 1
		}
	}
	return result
}

// splitOnColon splits a string by the first colon and trims whitespace.
func splitOnColon(s string) []string {
	for i := 0; i < len(s); i++ {
		if s[i] == ':' {
			left := trimSpace(s[:i])
			right := trimSpace(s[i+1:])
			if left != "" && right != "" {
				return []string{left, right}
			}
			return nil
		}
	}
	return nil
}

// trimSpace trims leading and trailing whitespace from a string.
func trimSpace(s string) string {
	start := 0
	end := len(s)
	for start < end && (s[start] == ' ' || s[start] == '\t' || s[start] == '\n' || s[start] == '\r') {
		start++
	}
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t' || s[end-1] == '\n' || s[end-1] == '\r') {
		end--
	}
	return s[start:end]
}
