import {
  EuiAccordion,
  EuiFieldNumber,
  EuiFormRow,
  EuiSpacer,
  EuiBadge,
  EuiFlexGroup,
  EuiFlexItem,
} from '@elastic/eui';
import type {
  ResourcesIntent,
  PodTemplateIntent,
  HttpIntent,
  MonitoringIntent,
  UpdateStrategyIntent,
  RefIntent,
} from '../../hooks/useDeploymentMutations';
import { NodeSetEditor, type NodeSetConfig } from '../elasticsearch/NodeSetEditor';
import { ResourceSizingFields } from './ResourceSizingFields';
import { PodSchedulingSection } from './PodSchedulingSection';
import { TlsHttpSection } from './TlsHttpSection';
import { MonitoringSection } from './MonitoringSection';
import { UpdateStrategySection } from './UpdateStrategySection';
import { UserSettingsSection } from './UserSettingsSection';
import { ElasticsearchRefDropdown } from './ElasticsearchRefDropdown';

export type ComponentType =
  | 'elasticsearch'
  | 'kibana'
  | 'fleet-server'
  | 'apm'
  | 'beat'
  | 'agent'
  | 'logstash'
  | 'enterprise-search'
  | 'maps';

/** The local state each component carries in the create/edit form. */
export interface ComponentFormState {
  enabled: boolean;
  count: number;
  nodeSets: NodeSetConfig[];
  // Enhanced fields
  config: Record<string, unknown>;
  resources: ResourcesIntent;
  podTemplate: PodTemplateIntent;
  http: HttpIntent;
  monitoring: MonitoringIntent;
  updateStrategy: UpdateStrategyIntent;
  elasticsearchRef: RefIntent | undefined;
  kibanaRef: RefIntent | undefined;
}

export function defaultComponentFormState(): ComponentFormState {
  return {
    enabled: false,
    count: 1,
    nodeSets: [
      {
        name: 'default',
        count: 3,
        roles: ['master', 'data', 'ingest'],
        memoryRequest: '2Gi',
        cpuRequest: '1',
        memoryLimit: '2Gi',
        cpuLimit: '1',
        storageSize: '10Gi',
        storageClass: '',
      },
    ],
    config: {},
    resources: {},
    podTemplate: {},
    http: {},
    monitoring: {},
    updateStrategy: {},
    elasticsearchRef: undefined,
    kibanaRef: undefined,
  };
}

interface ComponentConfiguratorProps {
  type: ComponentType;
  state: ComponentFormState;
  onChange: (updates: Partial<ComponentFormState>) => void;
  specFields: string[];
  /** Auto-wired ES cluster name for the deployment, e.g. "prod-es" */
  autoEsName?: string;
  /** Auto-wired Kibana name for the deployment, e.g. "prod-kb" */
  autoKbName?: string;
  /** ES clusters available in the namespace (for ref/monitoring dropdowns) */
  esClusters: string[];
  readOnly?: boolean;
}

/** Checks if a spec field is available (or if specFields is empty = show all). */
function hasField(specFields: string[], field: string): boolean {
  return specFields.length === 0 || specFields.includes(field);
}

/** Simple components = everything except ES, Beats, Agent */
const SIMPLE_TYPES: ComponentType[] = ['kibana', 'fleet-server', 'apm', 'logstash', 'enterprise-search', 'maps'];

/** Components with ES ref dropdown */
const ES_REF_TYPES: ComponentType[] = ['kibana', 'fleet-server', 'apm', 'beat', 'agent', 'logstash', 'enterprise-search', 'maps'];

/** Components with Kibana ref dropdown */
const KB_REF_TYPES: ComponentType[] = ['fleet-server', 'apm', 'agent'];

/** Components WITHOUT http field */
const NO_HTTP_TYPES: ComponentType[] = ['beat', 'agent'];

function accordionSummary(label: string, configured: boolean) {
  if (!configured) return label;
  return (
    <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
      <EuiFlexItem grow={false}>{label}</EuiFlexItem>
      <EuiFlexItem grow={false}>
        <EuiBadge color="hollow">Configured</EuiBadge>
      </EuiFlexItem>
    </EuiFlexGroup>
  );
}

export function ComponentConfigurator({
  type,
  state,
  onChange,
  specFields,
  autoEsName,
  autoKbName,
  esClusters,
  readOnly = false,
}: ComponentConfiguratorProps) {
  const isSimple = SIMPLE_TYPES.includes(type);
  const hasEsRef = ES_REF_TYPES.includes(type);
  const hasKbRef = KB_REF_TYPES.includes(type);
  const hasHttp = !NO_HTTP_TYPES.includes(type) && hasField(specFields, 'http');
  const hasMonitoring = hasField(specFields, 'monitoring');
  const isES = type === 'elasticsearch';

  // Determine if advanced sections have values
  const hasConfig = Object.keys(state.config).length > 0;
  const hasPodSched =
    Object.keys(state.podTemplate.nodeSelector ?? {}).length > 0 ||
    (state.podTemplate.tolerations?.length ?? 0) > 0 ||
    Object.keys(state.podTemplate.affinity ?? {}).length > 0;
  const hasHttpConfig =
    state.http.tls?.disabled === true ||
    !!state.http.tls?.secretName ||
    !!state.http.serviceType;
  const hasMonitoringConfig = !!state.monitoring.metricsRef || !!state.monitoring.logsRef;
  const hasUpdateStrat =
    state.updateStrategy.maxUnavailable != null || state.updateStrategy.maxSurge != null;

  return (
    <>
      {/* --- Basic Section --- */}
      {isES && (
        <NodeSetEditor
          nodeSets={state.nodeSets}
          onChange={(nodeSets) => onChange({ nodeSets })}
        />
      )}

      {isSimple && (
        <>
          <EuiFlexGroup>
            <EuiFlexItem grow={false} style={{ minWidth: 120 }}>
              <EuiFormRow label="Replicas">
                <EuiFieldNumber
                  value={state.count}
                  onChange={(e) =>
                    onChange({ count: parseInt(e.target.value, 10) || 1 })
                  }
                  min={1}
                  readOnly={readOnly}
                />
              </EuiFormRow>
            </EuiFlexItem>
            <EuiFlexItem>
              <ResourceSizingFields
                resources={state.resources}
                onChange={(resources) => onChange({ resources })}
                readOnly={readOnly}
              />
            </EuiFlexItem>
          </EuiFlexGroup>
        </>
      )}

      {/* ES ref dropdown for dependent components */}
      {hasEsRef && (
        <>
          <EuiSpacer size="m" />
          <ElasticsearchRefDropdown
            value={state.elasticsearchRef}
            onChange={(elasticsearchRef) => onChange({ elasticsearchRef })}
            autoName={autoEsName}
            esClusters={esClusters}
            label="Elasticsearch Reference"
            readOnly={readOnly}
          />
        </>
      )}

      {/* Kibana ref dropdown for APM and Agent */}
      {hasKbRef && (
        <>
          <EuiSpacer size="s" />
          <ElasticsearchRefDropdown
            value={state.kibanaRef}
            onChange={(kibanaRef) => onChange({ kibanaRef })}
            autoName={autoKbName}
            esClusters={[]} // Kibana clusters aren't listed separately
            label="Kibana Reference"
            readOnly={readOnly}
          />
        </>
      )}

      <EuiSpacer size="l" />

      {/* --- Advanced Sections (collapsed by default) --- */}

      {/* User Settings */}
      {hasField(specFields, 'config') && (
        <>
          <EuiAccordion
            id={`${type}-user-settings`}
            buttonContent={accordionSummary('User Settings', hasConfig)}
            paddingSize="m"
            initialIsOpen={false}
          >
            <UserSettingsSection
              config={state.config}
              onChange={(config) => onChange({ config })}
              componentType={type}
              readOnly={readOnly}
            />
          </EuiAccordion>
          <EuiSpacer size="s" />
        </>
      )}

      {/* Pod Scheduling */}
      <EuiAccordion
        id={`${type}-pod-scheduling`}
        buttonContent={accordionSummary('Pod Scheduling', hasPodSched)}
        paddingSize="m"
        initialIsOpen={false}
      >
        <PodSchedulingSection
          podTemplate={state.podTemplate}
          onChange={(podTemplate) => onChange({ podTemplate })}
          readOnly={readOnly}
        />
      </EuiAccordion>
      <EuiSpacer size="s" />

      {/* TLS & HTTP */}
      {hasHttp && (
        <>
          <EuiAccordion
            id={`${type}-tls-http`}
            buttonContent={accordionSummary('TLS & HTTP', hasHttpConfig)}
            paddingSize="m"
            initialIsOpen={false}
          >
            <TlsHttpSection
              http={state.http}
              onChange={(http) => onChange({ http })}
              readOnly={readOnly}
            />
          </EuiAccordion>
          <EuiSpacer size="s" />
        </>
      )}

      {/* Monitoring */}
      {hasMonitoring && (
        <>
          <EuiAccordion
            id={`${type}-monitoring`}
            buttonContent={accordionSummary('Monitoring', hasMonitoringConfig)}
            paddingSize="m"
            initialIsOpen={false}
          >
            <MonitoringSection
              monitoring={state.monitoring}
              onChange={(monitoring) => onChange({ monitoring })}
              esClusters={esClusters}
              readOnly={readOnly}
            />
          </EuiAccordion>
          <EuiSpacer size="s" />
        </>
      )}

      {/* Update Strategy (ES only) */}
      {isES && (
        <EuiAccordion
          id={`${type}-update-strategy`}
          buttonContent={accordionSummary('Update Strategy', hasUpdateStrat)}
          paddingSize="m"
          initialIsOpen={false}
        >
          <UpdateStrategySection
            updateStrategy={state.updateStrategy}
            onChange={(updateStrategy) => onChange({ updateStrategy })}
            readOnly={readOnly}
          />
        </EuiAccordion>
      )}
    </>
  );
}
