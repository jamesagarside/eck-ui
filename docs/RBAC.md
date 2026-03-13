# RBAC - Role-Based Access Control

ECK UI uses an ECE-aligned role model with four platform roles. Access is controlled declaratively through Kubernetes custom resources (`ECKUIRoleBinding`) and falls back to automatic role detection from existing Kubernetes RBAC permissions via SelfSubjectAccessReview probes.

## How Authentication Works

1. The user provides a Kubernetes bearer token (e.g., a ServiceAccount token) via the login API.
2. ECK UI validates the token against the Kubernetes `TokenReview` API.
3. On success, a server-side session is created and an HTTP-only secure cookie (`eck-ui-session`) is set.
4. The session stores the user's identity: username, UID, groups, resolved platform role, and optional organization context.
5. Sessions expire after 8 hours.

## Platform Roles

| Role | Level | Description |
|---|---|---|
| `platform-admin` | 4 | Full access. Can manage all resources, view administration pages, and configure the platform. |
| `deployment-manager` | 3 | Can create, edit, and delete ECK deployments and individual resources. Cannot access administration pages. |
| `platform-viewer` | 2 | Read-only access to all platform resources including individual Elasticsearch, Kibana, etc. Cannot create or modify resources. |
| `deployment-viewer` | 1 | Can only view deployments assigned to them. Sees a simplified UI with no access to individual resource pages or administration. |

Roles are hierarchical: a higher-level role inherits all permissions of lower-level roles.

## Role Resolution

When a user logs in, ECK UI resolves their platform role using a three-step chain. The first resolver to return a match wins:

### Step 1: ECKUIRoleBinding CRD

Checks for `ECKUIRoleBinding` custom resources that explicitly assign a role to the user by username or group membership. If multiple bindings match, the highest-privilege role wins.

This is the recommended way to manage access for production deployments.

### Step 2: SSAR (SelfSubjectAccessReview) Probes

If no CRD binding matches, ECK UI probes the user's effective Kubernetes permissions to infer a role:

| Probe | Permission Tested | Resulting Role |
|---|---|---|
| 1 | Can create `clusterrolebindings` | `platform-admin` |
| 2 | Can create `elasticsearches` | `deployment-manager` |
| 3a | Can get `elasticsearches` AND can get `secrets` | `platform-viewer` |
| 3b | Can get `elasticsearches` only | `deployment-viewer` |

This means existing Kubernetes RBAC (ClusterRoles, RoleBindings) is respected automatically with zero configuration.

### Step 3: Default Fallback

If neither CRD nor SSAR produces a match, the user defaults to `platform-admin`. This ensures the system is usable immediately after installation before any role bindings are created.

The resolved role is cached on the user's session for the duration of their login. To force re-evaluation, the user must log out and back in.

---

## ECKUIRoleBinding Custom Resource

The `ECKUIRoleBinding` CRD provides explicit, declarative role assignment. It takes precedence over automatic SSAR detection, allowing you to assign or restrict roles independently of Kubernetes RBAC.

### CRD Reference

| Field | Value |
|---|---|
| API Group | `ui.elastic.co` |
| API Version | `v1alpha1` |
| Kind | `ECKUIRoleBinding` |
| Short Name | `eckrb` |
| Scope | Cluster |

### Spec Fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `role` | string | Yes | -- | One of: `platform-admin`, `deployment-manager`, `platform-viewer`, `deployment-viewer` |
| `subjects` | array | Yes | -- | List of users or groups to assign the role to. Minimum 1 entry. |
| `subjects[].kind` | string | Yes | -- | Either `User` or `Group` |
| `subjects[].name` | string | Yes | -- | The username (from TokenReview) or group name to match |
| `eckInstance` | string | No | `local` | The ECK instance this binding applies to. Reserved for future multi-ECK support. |

### Creating Role Bindings

**Grant platform-admin to a specific user and a group:**

```yaml
apiVersion: ui.elastic.co/v1alpha1
kind: ECKUIRoleBinding
metadata:
  name: platform-admins
spec:
  role: platform-admin
  subjects:
    - kind: User
      name: admin@example.com
    - kind: Group
      name: platform-admins
```

**Grant deployment-manager to a DevOps team:**

```yaml
apiVersion: ui.elastic.co/v1alpha1
kind: ECKUIRoleBinding
metadata:
  name: devops-managers
spec:
  role: deployment-manager
  subjects:
    - kind: Group
      name: devops-team
```

**Grant platform-viewer to an operations group:**

```yaml
apiVersion: ui.elastic.co/v1alpha1
kind: ECKUIRoleBinding
metadata:
  name: ops-viewers
spec:
  role: platform-viewer
  subjects:
    - kind: Group
      name: operations
```

**Grant deployment-viewer to all developers:**

```yaml
apiVersion: ui.elastic.co/v1alpha1
kind: ECKUIRoleBinding
metadata:
  name: dev-viewers
spec:
  role: deployment-viewer
  subjects:
    - kind: Group
      name: developers
```

Apply with:

```bash
kubectl apply -f rolebinding.yaml
```

Pre-built examples for all four roles are available at `deploy/kubernetes/examples/rolebindings.yaml`.

### Managing Role Bindings

**List all role bindings:**

```bash
kubectl get eckuirolebindings
```

Or using the short name:

```bash
kubectl get eckrb
```

Example output:

```
NAME               ROLE                  ECK INSTANCE   AGE
platform-admins    platform-admin        local          5m
devops-managers    deployment-manager    local          5m
ops-viewers        platform-viewer       local          3m
dev-viewers        deployment-viewer     local          3m
```

**Inspect a binding:**

```bash
kubectl describe eckuirolebinding platform-admins
```

**Delete a binding:**

```bash
kubectl delete eckuirolebinding platform-admins
```

### Multiple Bindings for the Same User

If a user matches multiple `ECKUIRoleBinding` resources (e.g., via both a `User` subject and a `Group` subject in different bindings), the **highest-privilege role wins**.

For example, if a user is assigned `deployment-viewer` by one binding and `deployment-manager` by another, they receive `deployment-manager`.

### Overriding Kubernetes RBAC

Because the CRD resolver runs before the SSAR resolver, you can use `ECKUIRoleBinding` to restrict a user's ECK UI role below what their Kubernetes permissions would normally grant.

For example, a `cluster-admin` user who would normally get `platform-admin` via SSAR can be restricted to `deployment-viewer` in the UI:

```yaml
apiVersion: ui.elastic.co/v1alpha1
kind: ECKUIRoleBinding
metadata:
  name: restrict-cluster-admin
spec:
  role: deployment-viewer
  subjects:
    - kind: User
      name: cluster-admin@example.com
```

### ECK Instance Scoping

The `eckInstance` field defaults to `local` and is reserved for future multi-ECK support. When managing multiple ECK operator instances, role bindings can be scoped to a specific instance:

```yaml
apiVersion: ui.elastic.co/v1alpha1
kind: ECKUIRoleBinding
metadata:
  name: prod-admins
spec:
  role: platform-admin
  eckInstance: production-eck
  subjects:
    - kind: Group
      name: prod-admins
```

For single-ECK deployments, omit `eckInstance` or set it to `local`.

---

## UI Behaviour by Role

### Sidebar Navigation

| Section | platform-admin | deployment-manager | platform-viewer | deployment-viewer |
|---|---|---|---|---|
| Dashboard | Yes | Yes | Yes | No |
| Deployments | Yes | Yes | Yes | "My Deployments" only |
| Resources (ES, Kibana, etc.) | Yes | Yes | Yes | No |
| Stack Management | Yes | Yes | Yes | No |
| Administration | Yes | No | No | No |
| Settings | No | No | No | Yes |

### Route-Level Access

| Route Pattern | Minimum Role |
|---|---|
| `/deployments` (list) | Any authenticated user |
| `/deployments/create` | `deployment-manager` |
| `/deployments/:ns/:name` (view) | Any authenticated user |
| `/deployments/:ns/:name/edit` | `deployment-manager` |
| `/elasticsearch`, `/kibana`, etc. (list) | `platform-viewer` |
| `/elasticsearch/create`, etc. | `deployment-manager` |
| `/elasticsearch/:ns/:name` (view) | `platform-viewer` |
| `/elasticsearch/:ns/:name/edit` | `deployment-manager` |
| `/admin/*` | `platform-admin` |

### API-Level Access

The backend RBAC middleware enforces permissions by HTTP method:

| HTTP Method | Minimum Role |
|---|---|
| `GET`, `HEAD`, `OPTIONS` | `deployment-viewer` |
| `POST`, `PUT`, `PATCH` | `deployment-manager` |
| `DELETE` | `deployment-manager` |

Requests below the required role receive a `403 Forbidden` response.

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ROLE_BINDING_CACHE_TTL` | `30s` | How frequently `ECKUIRoleBinding` resources are refreshed from the Kubernetes API. Lower values mean faster propagation of role changes; higher values reduce API server load. Accepts Go duration strings (e.g., `10s`, `1m`, `5m`). |

### Helm Values

```yaml
config:
  roleBindingCacheTTL: "30s"
```

After changing a role binding, the new role takes effect within the cache TTL period (default 30 seconds). Users must log out and back in for the change to apply to their session.

---

## Kubernetes RBAC for the ECK UI Service Account

The ECK UI pod runs with a ServiceAccount that requires its own Kubernetes RBAC permissions. These are separate from user-level roles and are included automatically in the Helm chart.

If deploying without the Helm chart, the service account needs these ClusterRole rules:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: eck-ui
rules:
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
    resources: [pods, events, secrets, services]
    verbs: [get, list, watch]

  # Pod logs
  - apiGroups: [""]
    resources: [pods/log]
    verbs: [get]

  # ConfigMaps for version and org management
  - apiGroups: [""]
    resources: [configmaps]
    verbs: [get, list, watch, create, update]

  # Operator version detection
  - apiGroups: [apps]
    resources: [deployments, statefulsets]
    verbs: [get, list]

  # CRD metadata for resource discovery
  - apiGroups: [apiextensions.k8s.io]
    resources: [customresourcedefinitions]
    verbs: [get, list]

  # Token review for authentication delegation
  - apiGroups: [authentication.k8s.io]
    resources: [tokenreviews]
    verbs: [create]

  # SSAR probes for automatic role detection
  - apiGroups: [authorization.k8s.io]
    resources: [selfsubjectaccessreviews]
    verbs: [create]

  # ECK UI role bindings for RBAC resolution
  - apiGroups: [ui.elastic.co]
    resources: [eckuirolebindings]
    verbs: [get, list, watch]
```

---

## Zero-Config Operation

ECK UI works without any `ECKUIRoleBinding` resources. Out of the box:

1. Users with `cluster-admin` permissions are detected as `platform-admin` via SSAR probes.
2. Users with ECK resource creation permissions are detected as `deployment-manager`.
3. Users with read-only ECK permissions are detected as `platform-viewer` or `deployment-viewer`.
4. If SSAR probes cannot determine a role, the user defaults to `platform-admin` (safe for initial setup).

Create `ECKUIRoleBinding` resources when you need to:
- Explicitly assign roles to specific users or groups
- Override the automatically detected role (e.g., restrict a cluster-admin in the UI)
- Prepare for future SSO integration where Kubernetes RBAC may not be the source of truth

---

## Organization Model

Organizations provide multi-tenant namespace scoping. An organization groups a set of Kubernetes namespaces with a set of members.

### ConfigMap-Based Configuration

Organizations are defined as Kubernetes ConfigMaps with specific labels:

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

- A user can belong to multiple organizations.
- The active organization is stored in the user's session and can be switched via the UI.
- When an organization is active, resource listings are scoped to that organization's namespaces.

---

## Migration from Previous Role Model

The previous 3-role model (`admin`, `editor`, `viewer`) derived roles from Kubernetes group names. The new model resolves roles via the CRD/SSAR/Default chain described above.

| Old Role | How It Was Derived | New Equivalent |
|---|---|---|
| `admin` | Group name contains "admin" | `platform-admin` (via SSAR or CRD) |
| `editor` | Group name contains "editor" | `deployment-manager` (via SSAR or CRD) |
| `viewer` | All other groups | `platform-viewer` or `deployment-viewer` (via SSAR or CRD) |

No manual migration is required. Existing Kubernetes RBAC permissions are automatically detected via SSAR probes. Create `ECKUIRoleBinding` resources only if you want explicit control over role assignments.
