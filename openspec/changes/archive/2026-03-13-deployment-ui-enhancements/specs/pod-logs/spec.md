## ADDED Requirements

### Requirement: List pods belonging to an ECK resource
The system SHALL provide an API endpoint that returns pods belonging to a specific ECK resource, identified by ECK label selectors.

#### Scenario: Listing Elasticsearch pods
- **WHEN** a GET request is made to `/api/v1/pods/{namespace}?labelSelector=common.k8s.elastic.co/type=elasticsearch,elasticsearch.k8s.elastic.co/cluster-name={name}`
- **THEN** the response contains a JSON array of pod objects with name, phase, status conditions, container statuses, node name, and creation timestamp

#### Scenario: No matching pods
- **WHEN** a GET request is made with a label selector that matches no pods
- **THEN** the response contains an empty array with a 200 status

### Requirement: Stream pod container logs
The system SHALL provide an API endpoint that streams container logs from a specific pod as Server-Sent Events.

#### Scenario: Streaming logs with follow
- **WHEN** a GET request is made to `/api/v1/pods/{namespace}/{pod}/logs?container={container}&follow=true&tailLines=1000`
- **THEN** the response is an SSE stream where each event contains a log line, and new log lines are streamed in real-time as they are produced

#### Scenario: Fetching historical logs without follow
- **WHEN** a GET request is made to `/api/v1/pods/{namespace}/{pod}/logs?container={container}&tailLines=500`
- **THEN** the response contains the last 500 log lines as SSE events and the stream closes after all lines are sent

#### Scenario: Container not found
- **WHEN** a GET request specifies a container name that does not exist in the pod
- **THEN** the response returns a 400 error with a descriptive message

### Requirement: RBAC permits pod log access
The system SHALL include `pods/log` sub-resource permissions in the ClusterRole so that the service account can read container logs.

#### Scenario: ClusterRole includes pods/log
- **WHEN** the Helm chart or all-in-one manifest is applied
- **THEN** the ClusterRole grants `get` on the `pods/log` sub-resource in the core API group

### Requirement: Pod status table on resource detail pages
The system SHALL display a table of pods on each resource detail page in a "Pods" tab, showing pod name, status/phase, ready containers, restarts, node, and age.

#### Scenario: Viewing pods for a healthy Elasticsearch cluster
- **WHEN** user navigates to an Elasticsearch detail page and selects the "Pods" tab
- **THEN** a table shows all pods belonging to that Elasticsearch resource with columns: Name, Status, Ready, Restarts, Node, Age

#### Scenario: Pod status indicators
- **WHEN** a pod is in Running phase with all containers ready
- **THEN** the status column shows a green health indicator
- **WHEN** a pod is in Pending or CrashLoopBackOff state
- **THEN** the status column shows a yellow or red health indicator respectively

### Requirement: Log viewer panel for selected pod
The system SHALL display a log viewer panel when a user clicks on a pod in the pod table, showing streamed container logs.

#### Scenario: Opening logs for a pod
- **WHEN** user clicks on a pod name in the pod table
- **THEN** a log viewer panel opens below the table showing the last 1000 lines of the pod's main container logs, with new lines streaming in real-time

#### Scenario: Switching containers
- **WHEN** a pod has multiple containers and user selects a different container from the container dropdown
- **THEN** the log viewer closes the previous log stream and opens a new stream for the selected container

#### Scenario: Only one active log stream
- **WHEN** user clicks on a different pod while logs are streaming
- **THEN** the previous log stream is closed and a new stream is opened for the newly selected pod

### Requirement: Deployment detail aggregates pods across components
The system SHALL show pods across all components on the deployment detail page, with the ability to filter by component type.

#### Scenario: Viewing all deployment pods
- **WHEN** user navigates to a deployment detail page and selects the "Pods" tab
- **THEN** pods from all components (Elasticsearch, Kibana, Beats, etc.) are listed with a "Component" column identifying which resource owns each pod

#### Scenario: Filtering pods by component
- **WHEN** user selects a component filter (e.g. "Elasticsearch") on the deployment pods tab
- **THEN** only pods belonging to that component type are shown

### Requirement: Graceful degradation on insufficient RBAC
The system SHALL display a clear message when pod or log access is denied due to insufficient RBAC permissions.

#### Scenario: Missing pods/log permission
- **WHEN** user attempts to view pod logs but the service account lacks `pods/log` permission
- **THEN** the log viewer displays "Insufficient permissions to view pod logs. The eck-ui ClusterRole needs get access to the pods/log sub-resource."
