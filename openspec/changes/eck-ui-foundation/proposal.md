## Why

ECK (Elastic Cloud on Kubernetes) provides a powerful operator for deploying Elastic Stack on Kubernetes, but lacks a management UI comparable to Elastic Cloud or ECE. Users must manage everything through kubectl and YAML manifests, which creates friction for:

- Teams unfamiliar with Kubernetes
- Multi-tenant organizations requiring self-service deployment
- Operations teams needing visibility across many clusters
- Compliance requirements for audit trails and RBAC

Building an ECK UI enables the same user experience as Elastic Cloud while leveraging ECK's battle-tested operator for the actual orchestration.

## What Changes

This change establishes the foundational ECK UI application that provides:

- **Container-based deployment** - Runs as a pod within the ECK namespace, using service account authentication to interact with Kubernetes APIs
- **EUI-based interface** - Consistent look and feel with Elastic Cloud using the Elastic UI framework
- **Resource CRUD operations** - Deploy, view, update, and delete all ECK-managed resources:
  - Elasticsearch clusters (multi-node, multi-tier)
  - Kibana instances
  - APM Server
  - Fleet/Elastic Agent
  - Beats (Filebeat, Metricbeat, etc.)
  - Logstash
  - Enterprise Search
  - Elastic Maps Server
  - Package Registry
  - Stack Config Policies
  - Elasticsearch Autoscalers
- **Multi-org RBAC** - Organization-based access control where users can belong to multiple orgs, each with namespace isolation
- **Cluster health & monitoring** - Real-time status dashboards showing cluster health, resource utilization, and events
- **Audit logging** - OpenTelemetry-format logs capturing all mutations for compliance
- **Backend API** - RESTful API layer between UI and Kubernetes API, implementing business logic, validation, and RBAC

## Capabilities

### New Capabilities

- `ui-shell`: Core application shell with EUI, routing, navigation, and global state management
- `auth-rbac`: Authentication via service account, organization-based RBAC model, namespace isolation
- `resource-elasticsearch`: Elasticsearch cluster deployment, scaling, upgrades, and configuration
- `resource-kibana`: Kibana deployment and association with Elasticsearch
- `resource-apm`: APM Server deployment and configuration
- `resource-agent`: Fleet/Elastic Agent deployment and policy management
- `resource-beats`: Beats deployment (Filebeat, Metricbeat, Heartbeat, etc.)
- `resource-logstash`: Logstash pipeline deployment
- `resource-stack`: Full stack deployment wizard combining ES + Kibana + integrations
- `monitoring-dashboard`: Health dashboards showing cluster status, resource usage, events
- `audit-logging`: OpenTelemetry-format audit trail for all resource mutations
- `backend-api`: REST API server with Kubernetes client, validation, and authorization layer

### Modified Capabilities

_(None - greenfield project)_

## Impact

### Technical Impact

- **New containerized application** - Node.js/React frontend + Go/Node.js backend
- **Kubernetes integration** - Service account with RBAC permissions for ECK CRDs and core resources
- **Dependencies**:
  - Elastic EUI React component library
  - Kubernetes client library (client-go or kubernetes-client)
  - OpenTelemetry SDKs for audit logging
  - ECK operator (existing deployment)

### ECK CRDs Managed

Based on ECK operator v3 (from `../../Elastic/cloud-on-k8s/`):

| CRD | API Group | Purpose |
|-----|-----------|---------|
| Elasticsearch | elasticsearch.k8s.elastic.co/v1 | Cluster deployment with NodeSets, HTTP/transport config |
| Kibana | kibana.k8s.elastic.co/v1 | Kibana deployment with ES association |
| ApmServer | apm.k8s.elastic.co/v1 | APM Server instances |
| Agent | agent.k8s.elastic.co/v1 | Fleet-managed Elastic Agent |
| Beat | beat.k8s.elastic.co/v1 | Filebeat, Metricbeat, etc. |
| Logstash | logstash.k8s.elastic.co/v1 | Logstash pipelines |
| EnterpriseSearch | enterprisesearch.k8s.elastic.co/v1 | Enterprise Search deployment |
| ElasticMapsServer | maps.k8s.elastic.co/v1 | Maps server |
| PackageRegistry | packageregistry.k8s.elastic.co/v1 | EPR for air-gapped |
| StackConfigPolicy | stackconfigpolicy.k8s.elastic.co/v1 | Cross-cluster config |
| ElasticsearchAutoscaler | autoscaling.k8s.elastic.co/v1 | Autoscaling policies |
| AutoOpsAgentPolicy | autoops.k8s.elastic.co/v1 | AutoOps integration |

### Deployment Model

- Single namespace deployment (`elastic-system` or dedicated)
- Service account with cluster-wide read + namespaced write permissions
- Internal ClusterIP service (optional Ingress/LoadBalancer)
- ConfigMap-based configuration
- Secret-based sensitive config

### Security Considerations

- **No direct kubectl exposure** - UI abstracts Kubernetes complexity
- **Namespace isolation** - Orgs map to namespaces, UI enforces boundaries
- **Service account auth** - Pod authenticates to K8s API server
- **Audit every mutation** - Full trail of who did what when
- **HTTPS by default** - TLS for all external endpoints
