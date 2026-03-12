## ADDED Requirements

### Requirement: ComponentIntent type includes all new optional fields

The `ComponentIntent` TypeScript interface SHALL be extended with optional fields for all new configuration sections: `config`, `resources`, `podTemplate`, `http`, `monitoring`, `updateStrategy`, `elasticsearchRef`, and `kibanaRef`. All new fields SHALL be optional with undefined defaults.

#### Scenario: Minimal intent (backwards compatible)
- **WHEN** a component has only enabled and replicas set (no new fields)
- **THEN** the intent is valid and produces the same resource as before the enhancement

#### Scenario: Fully configured intent
- **WHEN** a component has all fields populated (config, resources, podTemplate, http, monitoring, updateStrategy, elasticsearchRef)
- **THEN** the intent is valid and the backend maps all fields to the K8s resource

### Requirement: Backend maps config intent to spec.config

The backend SHALL map the `config` field from `ComponentIntent` to `spec.config` on the K8s resource (or `spec.nodeSets[].config` for Elasticsearch). The mapping SHALL be guarded by `hasSpecField("config")`.

#### Scenario: Config for simple component
- **WHEN** the intent includes `config: { "server.host": "0.0.0.0" }` for Kibana
- **THEN** the backend sets `spec.config: { "server.host": "0.0.0.0" }` on the Kibana resource

#### Scenario: Config for Elasticsearch
- **WHEN** the intent includes `config` for Elasticsearch
- **THEN** the backend merges the config into each `spec.nodeSets[].config`

#### Scenario: Config field not in CRD
- **WHEN** the CRD for a resource type does not have "config" in specFields
- **THEN** the backend ignores the config intent field and does not set spec.config

### Requirement: Backend maps resources intent to podTemplate container resources

The backend SHALL map `ResourcesIntent` (memoryRequest, memoryLimit, cpuRequest, cpuLimit) to `spec.podTemplate.spec.containers[0].resources.requests` and `spec.podTemplate.spec.containers[0].resources.limits`.

#### Scenario: Full resource sizing
- **WHEN** the intent includes `resources: { memoryRequest: "2Gi", memoryLimit: "4Gi", cpuRequest: "500m", cpuLimit: "2" }`
- **THEN** the backend sets `spec.podTemplate.spec.containers[0].resources.requests.memory: "2Gi"`, `.requests.cpu: "500m"`, `.limits.memory: "4Gi"`, `.limits.cpu: "2"`

#### Scenario: Partial resource sizing
- **WHEN** the intent includes only `resources: { memoryRequest: "1Gi" }`
- **THEN** only `spec.podTemplate.spec.containers[0].resources.requests.memory` is set; other fields are omitted

#### Scenario: No resources
- **WHEN** the resources field is undefined
- **THEN** no podTemplate resource configuration is set on the K8s resource

### Requirement: Backend maps http intent to spec.http

The backend SHALL map `HttpIntent` fields to `spec.http` on the K8s resource, guarded by `hasSpecField("http")`.

#### Scenario: TLS disabled
- **WHEN** the intent includes `http: { tls: { disabled: true } }`
- **THEN** the backend sets `spec.http.tls.selfSignedCertificate.disabled: true`

#### Scenario: Custom TLS certificate
- **WHEN** the intent includes `http: { tls: { secretName: "my-cert" } }`
- **THEN** the backend sets `spec.http.tls.certificate.secretName: "my-cert"`

#### Scenario: Custom service type
- **WHEN** the intent includes `http: { serviceType: "LoadBalancer" }`
- **THEN** the backend sets `spec.http.service.spec.type: "LoadBalancer"`

#### Scenario: No http field in CRD
- **WHEN** the CRD does not have "http" in specFields
- **THEN** the backend ignores the http intent field

### Requirement: Backend maps monitoring intent to spec.monitoring

The backend SHALL map `MonitoringIntent` fields to `spec.monitoring` on the K8s resource, guarded by `hasSpecField("monitoring")`.

#### Scenario: Both metrics and logs
- **WHEN** the intent includes `monitoring: { metricsRef: { name: "monitor-es" }, logsRef: { name: "monitor-es" } }`
- **THEN** the backend sets `spec.monitoring.metrics.elasticsearchRefs[0].name: "monitor-es"` and `spec.monitoring.logs.elasticsearchRefs[0].name: "monitor-es"`

#### Scenario: Metrics only
- **WHEN** the intent includes `monitoring: { metricsRef: { name: "monitor-es" } }` with no logsRef
- **THEN** only `spec.monitoring.metrics.elasticsearchRefs` is set; logs is omitted

#### Scenario: No monitoring field in CRD
- **WHEN** the CRD does not have "monitoring" in specFields
- **THEN** the backend ignores the monitoring intent field

### Requirement: Backend maps updateStrategy intent to spec.updateStrategy

The backend SHALL map `UpdateStrategyIntent` fields to `spec.updateStrategy.changeBudget` on the Elasticsearch resource.

#### Scenario: Change budget set
- **WHEN** the intent includes `updateStrategy: { maxUnavailable: 1, maxSurge: -1 }`
- **THEN** the backend sets `spec.updateStrategy.changeBudget.maxUnavailable: 1` and `spec.updateStrategy.changeBudget.maxSurge: -1`

#### Scenario: Non-Elasticsearch component
- **WHEN** a non-Elasticsearch component has updateStrategy in its intent
- **THEN** the backend ignores the field (update strategy only applies to Elasticsearch)

### Requirement: Backend maps elasticsearchRef and kibanaRef intents

The backend SHALL map `elasticsearchRef` and `kibanaRef` from `ComponentIntent` to the appropriate spec field on the K8s resource. The backend SHALL use `hasSpecField` to determine whether to use `elasticsearchRef` or `elasticsearchRefs`.

#### Scenario: Override ES ref on Kibana
- **WHEN** the Kibana intent includes `elasticsearchRef: { name: "external-es" }`
- **THEN** the backend sets `spec.elasticsearchRef.name: "external-es"` on the Kibana resource (overriding the default auto-wired reference)

#### Scenario: Override ES ref on Agent with elasticsearchRefs
- **WHEN** the Agent CRD uses `elasticsearchRefs` (plural) and the intent includes `elasticsearchRef: { name: "external-es" }`
- **THEN** the backend sets `spec.elasticsearchRefs[0].name: "external-es"`

#### Scenario: No ref override
- **WHEN** the elasticsearchRef field is undefined in the intent
- **THEN** the backend uses the deployment's own ES cluster as the reference (existing behavior)
