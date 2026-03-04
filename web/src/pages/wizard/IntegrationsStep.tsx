// Step 3: Integrations Configuration (APM, Fleet, Beats)
import {
  EuiForm,
  EuiFormRow,
  EuiFieldText,
  EuiFieldNumber,
  EuiSelect,
  EuiSwitch,
  EuiSpacer,
  EuiPanel,
  EuiText,
  EuiFlexGroup,
  EuiFlexItem,
  EuiAccordion,
  EuiIcon,
  EuiCheckbox,
  EuiCallOut,
} from '@elastic/eui';
import { useWizard } from './WizardContext';
import type { BeatTypeConfig } from './types';

const BEAT_TYPE_INFO: Record<BeatTypeConfig['type'], { label: string; description: string }> = {
  filebeat: { label: 'Filebeat', description: 'Log file collection' },
  metricbeat: { label: 'Metricbeat', description: 'System and service metrics' },
  heartbeat: { label: 'Heartbeat', description: 'Uptime monitoring' },
  packetbeat: { label: 'Packetbeat', description: 'Network traffic analysis' },
  auditbeat: { label: 'Auditbeat', description: 'Audit events' },
};

export function IntegrationsStep() {
  const { state, toggleApm, updateApm, toggleFleet, updateFleet, toggleBeats, updateBeats } =
    useWizard();
  const { apm, fleet, beats, elasticsearch, kibana } = state;

  const handleBeatTypeToggle = (type: BeatTypeConfig['type']) => {
    if (!beats) return;
    const newTypes = beats.types.map((t) => (t.type === type ? { ...t, enabled: !t.enabled } : t));
    updateBeats({ types: newTypes });
  };

  const handleBeatTypeUpdate = (type: BeatTypeConfig['type'], update: Partial<BeatTypeConfig>) => {
    if (!beats) return;
    const newTypes = beats.types.map((t) => (t.type === type ? { ...t, ...update } : t));
    updateBeats({ types: newTypes });
  };

  const enabledBeatTypes = beats?.types.filter((t) => t.enabled) || [];

  return (
    <EuiForm>
      {/* APM Section */}
      <EuiPanel>
        <EuiAccordion
          id="apm-config"
          buttonContent={
            <EuiFlexGroup alignItems="center" gutterSize="m">
              <EuiFlexItem grow={false}>
                <EuiIcon type="apmApp" size="l" />
              </EuiFlexItem>
              <EuiFlexItem>
                <strong>APM Server</strong>
                <EuiText size="xs" color="subdued">
                  Application Performance Monitoring
                </EuiText>
              </EuiFlexItem>
            </EuiFlexGroup>
          }
          extraAction={
            <EuiSwitch
              label=""
              checked={!!apm}
              onChange={(e) => {
                e.stopPropagation();
                toggleApm(e.target.checked);
              }}
            />
          }
          paddingSize="m"
        >
          {apm && (
            <>
              <EuiSpacer size="m" />
              <EuiFlexGroup>
                <EuiFlexItem>
                  <EuiFormRow label="Name" helpText="Leave empty to auto-generate">
                    <EuiFieldText
                      value={apm.name}
                      onChange={(e) => updateApm({ name: e.target.value })}
                      placeholder={elasticsearch.name ? `${elasticsearch.name}-apm` : 'my-apm'}
                    />
                  </EuiFormRow>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiFormRow label="Replica Count">
                    <EuiFieldNumber
                      value={apm.count}
                      min={1}
                      max={10}
                      onChange={(e) => updateApm({ count: parseInt(e.target.value) || 1 })}
                    />
                  </EuiFormRow>
                </EuiFlexItem>
              </EuiFlexGroup>
              <EuiSpacer size="m" />
              <EuiSwitch
                label="Enable RUM (Real User Monitoring)"
                checked={apm.rum}
                onChange={(e) => updateApm({ rum: e.target.checked })}
              />
              <EuiText size="xs" color="subdued">
                Enable browser-based monitoring for frontend applications
              </EuiText>
            </>
          )}
        </EuiAccordion>
      </EuiPanel>

      <EuiSpacer size="m" />

      {/* Fleet Section */}
      <EuiPanel>
        <EuiAccordion
          id="fleet-config"
          buttonContent={
            <EuiFlexGroup alignItems="center" gutterSize="m">
              <EuiFlexItem grow={false}>
                <EuiIcon type="fleetApp" size="l" />
              </EuiFlexItem>
              <EuiFlexItem>
                <strong>Fleet Server</strong>
                <EuiText size="xs" color="subdued">
                  Central management for Elastic Agents
                </EuiText>
              </EuiFlexItem>
            </EuiFlexGroup>
          }
          extraAction={
            <EuiSwitch
              label=""
              checked={!!fleet}
              onChange={(e) => {
                e.stopPropagation();
                toggleFleet(e.target.checked);
              }}
            />
          }
          paddingSize="m"
        >
          {fleet && (
            <>
              <EuiSpacer size="m" />
              {!kibana && (
                <>
                  <EuiCallOut title="Kibana Required" color="warning" iconType="warning" size="s">
                    <p>Fleet Server requires Kibana to be enabled for agent policy management.</p>
                  </EuiCallOut>
                  <EuiSpacer size="m" />
                </>
              )}
              <EuiFlexGroup>
                <EuiFlexItem>
                  <EuiFormRow label="Name" helpText="Leave empty to auto-generate">
                    <EuiFieldText
                      value={fleet.name}
                      onChange={(e) => updateFleet({ name: e.target.value })}
                      placeholder={elasticsearch.name ? `${elasticsearch.name}-fleet` : 'my-fleet'}
                    />
                  </EuiFormRow>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiFormRow label="Replica Count">
                    <EuiFieldNumber
                      value={fleet.count}
                      min={1}
                      max={10}
                      onChange={(e) => updateFleet({ count: parseInt(e.target.value) || 1 })}
                    />
                  </EuiFormRow>
                </EuiFlexItem>
              </EuiFlexGroup>
              <EuiSpacer size="m" />
              <EuiFormRow label="Mode">
                <EuiSelect
                  options={[
                    { value: 'fleet', text: 'Fleet Mode (Centrally managed)' },
                    { value: 'standalone', text: 'Standalone Mode (Local config)' },
                  ]}
                  value={fleet.mode}
                  onChange={(e) => updateFleet({ mode: e.target.value as 'fleet' | 'standalone' })}
                />
              </EuiFormRow>
            </>
          )}
        </EuiAccordion>
      </EuiPanel>

      <EuiSpacer size="m" />

      {/* Beats Section */}
      <EuiPanel>
        <EuiAccordion
          id="beats-config"
          buttonContent={
            <EuiFlexGroup alignItems="center" gutterSize="m">
              <EuiFlexItem grow={false}>
                <EuiIcon type="logoBeats" size="l" />
              </EuiFlexItem>
              <EuiFlexItem>
                <strong>Beats</strong>
                <EuiText size="xs" color="subdued">
                  Lightweight data shippers
                </EuiText>
              </EuiFlexItem>
            </EuiFlexGroup>
          }
          extraAction={
            <EuiSwitch
              label=""
              checked={!!beats}
              onChange={(e) => {
                e.stopPropagation();
                toggleBeats(e.target.checked);
              }}
            />
          }
          paddingSize="m"
        >
          {beats && (
            <>
              <EuiSpacer size="m" />
              <EuiText size="s" color="subdued">
                <p>Select which Beats to deploy:</p>
              </EuiText>
              <EuiSpacer size="m" />

              {beats.types.map((beatType) => {
                const info = BEAT_TYPE_INFO[beatType.type];
                return (
                  <div key={beatType.type}>
                    <EuiFlexGroup alignItems="center" gutterSize="m">
                      <EuiFlexItem grow={false}>
                        <EuiCheckbox
                          id={`beat-${beatType.type}`}
                          checked={beatType.enabled}
                          onChange={() => handleBeatTypeToggle(beatType.type)}
                          label=""
                        />
                      </EuiFlexItem>
                      <EuiFlexItem>
                        <strong>{info.label}</strong>
                        <EuiText size="xs" color="subdued">
                          {info.description}
                        </EuiText>
                      </EuiFlexItem>
                    </EuiFlexGroup>

                    {beatType.enabled && (
                      <div style={{ marginLeft: 32, marginTop: 8 }}>
                        <EuiFlexGroup gutterSize="m">
                          <EuiFlexItem grow={1}>
                            <EuiFormRow label="Name" display="rowCompressed">
                              <EuiFieldText
                                compressed
                                value={beatType.name}
                                onChange={(e) =>
                                  handleBeatTypeUpdate(beatType.type, { name: e.target.value })
                                }
                                placeholder={`my-${beatType.type}`}
                              />
                            </EuiFormRow>
                          </EuiFlexItem>
                          <EuiFlexItem grow={1}>
                            <EuiFormRow label="Deployment" display="rowCompressed">
                              <EuiSelect
                                compressed
                                options={[
                                  { value: 'daemonset', text: 'DaemonSet (per node)' },
                                  { value: 'deployment', text: 'Deployment (replicas)' },
                                ]}
                                value={beatType.deployment}
                                onChange={(e) =>
                                  handleBeatTypeUpdate(beatType.type, {
                                    deployment: e.target.value as 'daemonset' | 'deployment',
                                  })
                                }
                              />
                            </EuiFormRow>
                          </EuiFlexItem>
                        </EuiFlexGroup>
                      </div>
                    )}
                    <EuiSpacer size="s" />
                  </div>
                );
              })}

              {enabledBeatTypes.length === 0 && (
                <EuiText size="s" color="subdued">
                  <p>No Beats selected. Enable at least one to deploy.</p>
                </EuiText>
              )}
            </>
          )}
        </EuiAccordion>
      </EuiPanel>

      <EuiSpacer size="l" />

      <EuiCallOut title="Tip: Start Simple" iconType="iInCircle" color="primary">
        <p>
          You can always add more integrations later. We recommend starting with just Elasticsearch
          and Kibana, then adding APM, Fleet, or Beats as needed.
        </p>
      </EuiCallOut>
    </EuiForm>
  );
}
