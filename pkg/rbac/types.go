package rbac

import metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

const (
	// CRD coordinates
	Group    = "ui.elastic.co"
	Version  = "v1alpha1"
	Resource = "eckuirolebindings"
	Kind     = "ECKUIRoleBinding"

	// DefaultECKInstance is used when no eckInstance is specified.
	DefaultECKInstance = "local"
)

// ECKUIRoleBinding assigns a platform role to users or groups for a
// specific ECK instance.
type ECKUIRoleBinding struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`
	Spec              ECKUIRoleBindingSpec `json:"spec"`
}

// ECKUIRoleBindingSpec defines the desired state of an ECKUIRoleBinding.
type ECKUIRoleBindingSpec struct {
	// Role is the platform role to assign.
	Role PlatformRole `json:"role"`

	// ECKInstance identifies the ECK instance this binding applies to.
	// Defaults to "local".
	ECKInstance string `json:"eckInstance,omitempty"`

	// Subjects are the users or groups to assign the role to.
	Subjects []RoleBindingSubject `json:"subjects"`
}

// RoleBindingSubject identifies a user or group.
type RoleBindingSubject struct {
	// Kind is either "User" or "Group".
	Kind string `json:"kind"`

	// Name is the username or group name.
	Name string `json:"name"`
}

// ECKUIRoleBindingList is a list of ECKUIRoleBinding resources.
type ECKUIRoleBindingList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []ECKUIRoleBinding `json:"items"`
}

// EffectiveECKInstance returns the ECK instance, defaulting to "local".
func (s *ECKUIRoleBindingSpec) EffectiveECKInstance() string {
	if s.ECKInstance == "" {
		return DefaultECKInstance
	}
	return s.ECKInstance
}

// MatchesUser returns true if any subject matches the given username or groups.
func (s *ECKUIRoleBindingSpec) MatchesUser(username string, groups []string) bool {
	groupSet := make(map[string]struct{}, len(groups))
	for _, g := range groups {
		groupSet[g] = struct{}{}
	}

	for _, subj := range s.Subjects {
		switch subj.Kind {
		case "User":
			if subj.Name == username {
				return true
			}
		case "Group":
			if _, ok := groupSet[subj.Name]; ok {
				return true
			}
		}
	}
	return false
}
