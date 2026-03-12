## ADDED Requirements

### Requirement: Shared useResourceForm hook
The system SHALL provide a `useResourceForm<T>` hook that manages form state, field-level validation, dirty tracking, and submission for resource create and edit pages. The hook SHALL accept a configuration object with `initialValues`, `validate`, and `onSubmit` properties.

#### Scenario: Form initializes with default values
- **WHEN** a create page renders with `useResourceForm({ initialValues: { name: '', namespace: 'default' } })`
- **THEN** the form fields SHALL be populated with the provided initial values
- **AND** `form.isDirty` SHALL be `false`

#### Scenario: Form initializes with existing resource data
- **WHEN** an edit page provides existing resource data as `initialValues`
- **THEN** the form fields SHALL be populated with the resource's current values
- **AND** the name and namespace fields SHALL be read-only

### Requirement: Real-time field-level validation
The system SHALL validate individual fields when they lose focus (onBlur) and display inline error messages below the field. The submit button SHALL be disabled when any field has a validation error.

#### Scenario: Invalid Kubernetes name shows inline error
- **WHEN** a user types "My Cluster" in the name field and tabs away
- **THEN** an inline error message SHALL appear: "Must be lowercase alphanumeric characters or '-', start and end with alphanumeric"
- **AND** the Create/Save button SHALL be disabled

#### Scenario: Valid field clears error
- **WHEN** a user corrects an invalid field value to a valid one and tabs away
- **THEN** the inline error message SHALL be removed
- **AND** the Create/Save button SHALL be enabled (if no other errors exist)

### Requirement: Dirty state tracking
The system SHALL track whether the form has been modified from its initial values. When a user attempts to navigate away from a dirty form, the system SHALL display a confirmation prompt.

#### Scenario: User navigates away from dirty form
- **WHEN** a user modifies a form field and clicks a navigation link
- **THEN** a confirmation dialog SHALL appear: "You have unsaved changes. Are you sure you want to leave?"
- **AND** the user can choose to stay or leave

#### Scenario: Clean form allows navigation
- **WHEN** a user has not modified any form fields and clicks a navigation link
- **THEN** navigation SHALL proceed without a confirmation prompt

### Requirement: Shared validation functions
The system SHALL provide reusable validation functions: `validateK8sName` (Kubernetes naming rules), `validateRequired` (non-empty), and `validatePositiveInteger` (count/replica fields). All create/edit pages SHALL use these shared validators instead of inline validation logic.

#### Scenario: K8s name validation rejects invalid characters
- **WHEN** `validateK8sName("my_cluster")` is called
- **THEN** it SHALL return an error string describing the naming constraint

#### Scenario: K8s name validation accepts valid names
- **WHEN** `validateK8sName("my-cluster-01")` is called
- **THEN** it SHALL return `undefined` (no error)
