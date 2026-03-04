# Upgrade Guide

This document covers how to upgrade ECK UI, version compatibility requirements, and rollback procedures.

## Helm Upgrade

To upgrade ECK UI to a new version using Helm:

```bash
# Review what will change before applying
helm diff upgrade eck-ui deploy/helm/eck-ui \
  --namespace eck-ui \
  --reuse-values

# Perform the upgrade
helm upgrade eck-ui deploy/helm/eck-ui \
  --namespace eck-ui \
  --reuse-values
```

If you need to override values during the upgrade:

```bash
helm upgrade eck-ui deploy/helm/eck-ui \
  --namespace eck-ui \
  --reuse-values \
  --set image.tag=0.2.0
```

### Verify the Upgrade

```bash
# Check rollout status
kubectl -n eck-ui rollout status deployment/eck-ui

# Verify the pod is running
kubectl -n eck-ui get pods -l app.kubernetes.io/name=eck-ui

# Check health endpoints
kubectl -n eck-ui port-forward svc/eck-ui 8080:8080 &
curl -s http://localhost:8080/healthz
curl -s http://localhost:8080/readyz
```

## kubectl Upgrade

If you installed with plain manifests:

```bash
kubectl apply -f deploy/kubernetes/all-in-one.yaml
```

Verify the rollout:

```bash
kubectl -n eck-ui rollout status deployment/eck-ui
```

## Version Compatibility

ECK UI manages ECK custom resources through the Kubernetes API. It depends on the ECK CRD versions being available in the cluster.

| ECK UI Version | Minimum ECK Version | Kubernetes Version |
|---|---|---|
| 0.1.x | ECK 2.x | 1.27+ |

### CRD API Versions Used

ECK UI uses the following CRD API versions. Ensure your ECK operator version provides these:

| Resource | API Group | Version |
|---|---|---|
| Elasticsearch | `elasticsearch.k8s.elastic.co` | `v1` |
| Kibana | `kibana.k8s.elastic.co` | `v1` |
| APM Server | `apm.k8s.elastic.co` | `v1` |
| Beat | `beat.k8s.elastic.co` | `v1beta1` |
| Elastic Agent | `agent.k8s.elastic.co` | `v1alpha1` |
| Logstash | `logstash.k8s.elastic.co` | `v1alpha1` |
| Enterprise Search | `enterprisesearch.k8s.elastic.co` | `v1` |
| Elastic Maps Server | `maps.k8s.elastic.co` | `v1alpha1` |
| Elasticsearch Autoscaler | `autoscaling.k8s.elastic.co` | `v1alpha1` |
| Stack Config Policy | `stackconfigpolicy.k8s.elastic.co` | `v1alpha1` |

If a CRD is not installed in your cluster, API calls for that resource type will return errors. ECK UI continues to function for all other resource types.

## Breaking Changes

### v0.1.0

Initial release. No breaking changes from prior versions.

## Rollback

### Helm Rollback

Helm tracks revision history, making rollback straightforward:

```bash
# List revision history
helm history eck-ui --namespace eck-ui

# Rollback to the previous revision
helm rollback eck-ui --namespace eck-ui

# Rollback to a specific revision
helm rollback eck-ui 2 --namespace eck-ui
```

### kubectl Rollback

For manifest-based installations, use the Kubernetes deployment rollout history:

```bash
# View rollout history
kubectl -n eck-ui rollout history deployment/eck-ui

# Rollback to the previous revision
kubectl -n eck-ui rollout undo deployment/eck-ui

# Rollback to a specific revision
kubectl -n eck-ui rollout undo deployment/eck-ui --to-revision=2
```

### Verifying Rollback

After rollback, confirm the service is healthy:

```bash
kubectl -n eck-ui rollout status deployment/eck-ui
kubectl -n eck-ui get pods -l app.kubernetes.io/name=eck-ui
```

## Session Handling During Upgrades

ECK UI stores sessions in-memory. When the pod restarts during an upgrade, all active sessions are lost and users will need to log in again. This is expected behavior.

To minimize disruption, perform upgrades during low-traffic periods.

## Data Safety

ECK UI does not store any persistent data. All resource state is managed by the Kubernetes API server and the ECK operator. Upgrading, rolling back, or removing ECK UI has no effect on your Elastic Stack deployments.
