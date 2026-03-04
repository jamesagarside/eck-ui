import {
  EuiForm,
  EuiFormRow,
  EuiFieldText,
  EuiFieldNumber,
  EuiSwitch,
  EuiSpacer,
  EuiButton,
  EuiButtonEmpty,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiTitle,
} from '@elastic/eui';
import { useWizard } from './WizardContext';

export function IntegrationsStep() {
  const { state, updateIntegrations, nextStep, prevStep } = useWizard();
  const { integrations } = state;

  return (
    <EuiForm>
      <EuiPanel>
        <EuiTitle size="xs">
          <h3>APM Server</h3>
        </EuiTitle>
        <EuiSpacer size="m" />

        <EuiFormRow>
          <EuiSwitch
            label="Deploy APM Server"
            checked={integrations.apm.enabled}
            onChange={(e) =>
              updateIntegrations({
                apm: { ...integrations.apm, enabled: e.target.checked },
              })
            }
          />
        </EuiFormRow>

        {integrations.apm.enabled && (
          <>
            <EuiSpacer size="m" />
            <EuiFormRow label="APM Server Name">
              <EuiFieldText
                value={integrations.apm.name}
                onChange={(e) =>
                  updateIntegrations({
                    apm: { ...integrations.apm, name: e.target.value },
                  })
                }
                placeholder={`${state.elasticsearch.name}-apm`}
              />
            </EuiFormRow>
            <EuiFormRow label="Replicas">
              <EuiFieldNumber
                value={integrations.apm.count}
                onChange={(e) =>
                  updateIntegrations({
                    apm: {
                      ...integrations.apm,
                      count: parseInt(e.target.value, 10) || 1,
                    },
                  })
                }
                min={1}
              />
            </EuiFormRow>
          </>
        )}
      </EuiPanel>

      <EuiSpacer size="l" />

      <EuiPanel>
        <EuiTitle size="xs">
          <h3>Fleet Server</h3>
        </EuiTitle>
        <EuiSpacer size="m" />

        <EuiFormRow>
          <EuiSwitch
            label="Deploy Fleet Server (Elastic Agent)"
            checked={integrations.fleet.enabled}
            onChange={(e) =>
              updateIntegrations({
                fleet: {
                  ...integrations.fleet,
                  enabled: e.target.checked,
                },
              })
            }
          />
        </EuiFormRow>

        {integrations.fleet.enabled && (
          <>
            <EuiSpacer size="m" />
            <EuiFormRow label="Fleet Server Name">
              <EuiFieldText
                value={integrations.fleet.name}
                onChange={(e) =>
                  updateIntegrations({
                    fleet: {
                      ...integrations.fleet,
                      name: e.target.value,
                    },
                  })
                }
                placeholder={`${state.elasticsearch.name}-fleet`}
              />
            </EuiFormRow>
          </>
        )}
      </EuiPanel>

      <EuiSpacer size="l" />

      <EuiFlexGroup justifyContent="spaceBetween">
        <EuiFlexItem grow={false}>
          <EuiButtonEmpty onClick={prevStep}>Back: Kibana</EuiButtonEmpty>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButton fill onClick={nextStep}>
            Next: Review
          </EuiButton>
        </EuiFlexItem>
      </EuiFlexGroup>
    </EuiForm>
  );
}
