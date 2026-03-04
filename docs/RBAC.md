# RBAC - Role-Based Access Control

ECK UI enforces role-based access control at two levels: Kubernetes RBAC for the service account, and application-level RBAC for individual users.

## How Authentication Works

1. The user provides a Kubernetes bearer token (e.g., a ServiceAccount token) via the login API.
2. ECK UI validates the token against the Kubernetes `TokenReview` API.
3. On success, a server-side session is created and an HTTP-only secure cookie (`eck-ui-session`) is set.
4. The session stores the user's identity: username, UID, groups, and optional organization context.
5. Sessions expire after 8 hours.

## User Roles

Roles are derived from the authenticated user's Kubernetes group membership. The RBAC middleware inspects group names and assigns the highest matching role.

| Role | Derived When | Permissions |
|---|---|---|
| **admin** | Any group name contains `admin` | Full access: read, create, update, delete |
| **editor** | Any group name contains `editor` | Read and write: read, create, update |
| **viewer** | Default (no admin/editor groups) | Read only: list and get resources |

### Role-to-HTTP-Method Mapping

| HTTP Method | Required Role |
|---|---|
| `GET`, `HEAD`, `OPTIONS` | viewer |
| `POST`, `PUT`, `PATCH` | editor |
| `DELETE` | admin |

Roles are hierarchical: admin includes all editor permissions, and editor includes all viewer permissions.

### Examples

A user with Kubernetes groups `["system:authenticated", "team-editors"]` is assigned the **editor** role because the group name contains "editor".

A user with groups `["system:authenticated", "cluster-admins"]` is assigned the **admin** role because the group name contains "admin".

A user with groups `["system:authenticated"]` is assigned the default **viewer** role.

## Organization Model

Organizations provide multi-tenant namespace scoping. An organization groups a set of Kubernetes namespaces with a set of members and their roles.

### Structure

```
Organization
  |-- name            (unique identifier)
  |-- displayName     (human-readable label)
  |-- namespaces[]    (Kubernetes namespaces this org has access to)
  |-- members[]
       |-- username   (Kubernetes username)
       |-- role       (admin | editor | viewer)
```

### ConfigMap-Based Configuration

Organizations are defined as Kubernetes ConfigMaps in a designated namespace. Each ConfigMap represents one organization.

**Required labels:**

```yaml
labels:
  app.kubernetes.io/managed-by: eck-ui
  eck-ui.elastic.co/type: organization
```

**Data keys:**

| Key | Format | Description |
|---|---|---|
| `displayName` | string | Human-readable name |
| `namespaces` | comma-separated | Kubernetes namespaces in this org |
| `members` | comma-separated | User-role pairs in `username:role` format |

### Example ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: team-platform
  namespace: eck-ui
  labels:
    app.kubernetes.io/managed-by: eck-ui
    eck-ui.elastic.co/type: organization
data:
  displayName: "Platform Team"
  namespaces: "elastic-prod, elastic-staging"
  members: "alice:admin, bob:editor, carol:viewer"
```

This creates an organization called `team-platform` where:

- Alice has admin access to resources in `elastic-prod` and `elastic-staging`
- Bob has editor access (can create and modify, but not delete)
- Carol has viewer access (read-only)

### Organization Membership

- A user can belong to multiple organizations.
- The active organization is stored in the user's session and can be switched via the UI.
- When an organization is active, resource listings are scoped to that organization's namespaces.

## Kubernetes RBAC for the ECK UI Service Account

The ECK UI pod runs with a ServiceAccount that requires its own Kubernetes RBAC permissions. These are separate from user-level roles.

The service account needs:

```yaml
# Full access to all ECK CRD resources
- apiGroups:
    - elasticsearch.k8s.elastic.co
    - kibana.k8s.elastic.co
    - apm.k8s.elastic.co
    - beat.k8s.elastic.co
    - agent.k8s.elastic.co
    - maps.k8s.elastic.co
    - logstash.k8s.elastic.co
    - enterprisesearch.k8s.elastic.co
    - autoscaling.k8s.elastic.co
    - stackconfigpolicy.k8s.elastic.co
  resources: ["*"]
  verbs: ["*"]

# Read-only access to core resources
- apiGroups: [""]
  resources: [pods, events, secrets, services, configmaps]
  verbs: [get, list, watch]

# Token review for authentication delegation
- apiGroups: [authentication.k8s.io]
  resources: [tokenreviews]
  verbs: [create]
```

The Helm chart and `all-in-one.yaml` manifest include these RBAC resources automatically.

## Future: CRD-Based Organizations

The ConfigMap-based organization model is the current implementation. A future version will introduce a dedicated `Organization` CRD for:

- Kubernetes-native lifecycle management
- Validation via admission webhooks
- Status reporting and condition tracking
- Controller-based reconciliation
