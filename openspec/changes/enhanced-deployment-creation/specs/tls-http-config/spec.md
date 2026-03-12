## ADDED Requirements

### Requirement: TLS mode selector provides three TLS configurations

Components with an HTTP endpoint (Elasticsearch, Kibana, APM, Enterprise Search, Maps) SHALL display a TLS mode selector with three options: "Self-signed (default)", "Disabled", and "Custom certificate". The selector SHALL only be visible when the CRD specFields includes "http".

#### Scenario: Default self-signed TLS
- **WHEN** the TLS mode selector is set to "Self-signed (default)"
- **THEN** no TLS configuration is included in the intent (ECK generates self-signed certs)

#### Scenario: TLS disabled
- **WHEN** the TLS mode selector is set to "Disabled"
- **THEN** the intent includes `http.tls.disabled: true`
- **AND** the backend sets `spec.http.tls.selfSignedCertificate.disabled: true` on the resource

#### Scenario: Custom certificate
- **WHEN** the TLS mode selector is set to "Custom certificate"
- **THEN** a text field for the TLS secret name is displayed
- **AND** the intent includes `http.tls.secretName: "<user-entered-name>"`
- **AND** the backend sets `spec.http.tls.certificate.secretName` on the resource

#### Scenario: Custom certificate without secret name
- **WHEN** user selects "Custom certificate" but leaves the secret name empty
- **THEN** a validation error is shown on the secret name field
- **AND** the Create Deployment button is disabled

### Requirement: Service type selector provides Kubernetes service types

Components with an HTTP endpoint SHALL display a service type dropdown with options: "ClusterIP (default)", "LoadBalancer", and "NodePort".

#### Scenario: Default ClusterIP
- **WHEN** the service type is set to "ClusterIP (default)"
- **THEN** no service type configuration is included in the intent (K8s default applies)

#### Scenario: LoadBalancer service
- **WHEN** the service type is set to "LoadBalancer"
- **THEN** the intent includes `http.serviceType: "LoadBalancer"`
- **AND** the backend sets `spec.http.service.spec.type: "LoadBalancer"` on the resource

#### Scenario: NodePort service
- **WHEN** the service type is set to "NodePort"
- **THEN** the intent includes `http.serviceType: "NodePort"`
- **AND** the backend sets `spec.http.service.spec.type: "NodePort"` on the resource

### Requirement: TLS section is gated by CRD spec fields

The TLS & HTTP section SHALL only be rendered when the resource type's CRD includes "http" in its specFields. If specFields is empty (CRD discovery failed), the section SHALL be shown.

#### Scenario: CRD has http field
- **WHEN** specFields for the component type includes "http"
- **THEN** the TLS & HTTP accordion section is visible

#### Scenario: CRD lacks http field
- **WHEN** specFields for the component type does not include "http"
- **THEN** the TLS & HTTP section is hidden

#### Scenario: Beats and Agent
- **WHEN** the component type is Beats or Agent
- **THEN** the TLS & HTTP section is never shown (these types do not have HTTP endpoints)
