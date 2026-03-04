# RBAC Configuration Guide

This guide explains how to configure Role-Based Access Control (RBAC) for ECK UI.

## ServiceAccount Setup

ECK UI needs a ServiceAccount to interact with the Kubernetes API. Create one in the namespace where ECK UI is deployed:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: eck-ui
  namespace: elastic-system
```

## ClusterRole

The ECK UI requires permissions to manage ECK resources across namespaces:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: eck-ui
rules:
  # Namespace access (for listing available namespaces)
  - apiGroups: [""]
    resources: ["namespaces"]
    verbs: ["get", "list", "watch"]

  # Pod/Event access (for viewing logs and events)
  - apiGroups: [""]
    resources: ["pods", "pods/log", "events"]
    verbs: ["get", "list", "watch"]

  # Secret access (for retrieving credentials)
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get", "list"]

  # Elasticsearch
  - apiGroups: ["elasticsearch.k8s.elastic.co"]
    resources: ["elasticsearches", "elasticsearches/status"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]

  # Kibana
  - apiGroups: ["kibana.k8s.elastic.co"]
    resources: ["kibanas", "kibanas/status"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]

  # APM Server
  - apiGroups: ["apm.k8s.elastic.co"]
    resources: ["apmservers", "apmservers/status"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]

  # Elastic Agent
  - apiGroups: ["agent.k8s.elastic.co"]
    resources: ["agents", "agents/status"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]

  # Beat
  - apiGroups: ["beat.k8s.elastic.co"]
    resources: ["beats", "beats/status"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]

  # Enterprise Search
  - apiGroups: ["enterprisesearch.k8s.elastic.co"]
    resources: ["enterprisesearches", "enterprisesearches/status"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]

  # Elastic Maps Server
  - apiGroups: ["maps.k8s.elastic.co"]
    resources: ["elasticmapsservers", "elasticmapsservers/status"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]

  # Logstash
  - apiGroups: ["logstash.k8s.elastic.co"]
    resources: ["logstashes", "logstashes/status"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]

  # Stack Config Policies (optional)
  - apiGroups: ["stackconfigpolicy.k8s.elastic.co"]
    resources: ["stackconfigpolicies", "stackconfigpolicies/status"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
```

## ClusterRoleBinding

Bind the ClusterRole to the ServiceAccount:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: eck-ui
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: eck-ui
subjects:
  - kind: ServiceAccount
    name: eck-ui
    namespace: elastic-system
```

## Namespace-Scoped Access (Alternative)

If you prefer to restrict ECK UI to specific namespaces, use Role/RoleBinding instead:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: eck-ui
  namespace: my-namespace
rules:
  # Same rules as ClusterRole, but scoped to this namespace
  - apiGroups: ["elasticsearch.k8s.elastic.co"]
    resources: ["elasticsearches", "elasticsearches/status"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  # ... etc
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: eck-ui
  namespace: my-namespace
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: eck-ui
subjects:
  - kind: ServiceAccount
    name: eck-ui
    namespace: elastic-system
```

## Read-Only Access

For users who should only view resources without modification:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: eck-ui-viewer
rules:
  - apiGroups: [""]
    resources: ["namespaces", "pods", "pods/log", "events"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["elasticsearch.k8s.elastic.co"]
    resources: ["elasticsearches", "elasticsearches/status"]
    verbs: ["get", "list", "watch"]
  # ... similar for other resources
```

## Verifying Permissions

Test the ServiceAccount has the required permissions:

```bash
# Check if the service account can list Elasticsearch resources
kubectl auth can-i list elasticsearches \
  --as=system:serviceaccount:elastic-system:eck-ui \
  --all-namespaces

# Check if the service account can create Elasticsearch resources
kubectl auth can-i create elasticsearches \
  --as=system:serviceaccount:elastic-system:eck-ui \
  -n default
```

## Minimal Permissions

For a more restrictive setup, you can limit ECK UI to specific actions:

| Action           | Required Verbs         |
| ---------------- | ---------------------- |
| View resources   | `get`, `list`, `watch` |
| Create resources | `create`               |
| Edit resources   | `update`, `patch`      |
| Delete resources | `delete`               |

## Troubleshooting

### "Forbidden" errors

If ECK UI shows permission errors:

1. Check the ServiceAccount is correctly configured
2. Verify the ClusterRoleBinding references the correct ServiceAccount
3. Ensure the ClusterRole has the necessary permissions
4. Check if any namespace-level RoleBindings are overriding cluster-level permissions

### Missing resources

If some resource types don't appear:

1. Ensure the ECK operator has registered the CRDs
2. Verify the ClusterRole includes the correct API groups
3. Check for typos in resource names (they must match the CRD plural names)

### Pod logs not accessible

Add these rules to access pod logs:

```yaml
- apiGroups: [""]
  resources: ["pods", "pods/log"]
  verbs: ["get", "list"]
```
