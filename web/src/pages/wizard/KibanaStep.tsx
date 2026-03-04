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

export function KibanaStep() {
  const { state, updateKibana, nextStep, prevStep } = useWizard();
  const { kibana } = state;

  return (
    <EuiForm>
      <EuiPanel>
        <EuiTitle size="xs">
          <h3>Kibana Configuration</h3>
        </EuiTitle>
        <EuiSpacer size="m" />

        <EuiFormRow>
          <EuiSwitch
            label="Deploy Kibana"
            checked={kibana.enabled}
            onChange={(e) => updateKibana({ enabled: e.target.checked })}
          />
        </EuiFormRow>

        {kibana.enabled && (
          <>
            <EuiSpacer size="m" />
            <EuiFormRow
              label="Instance Name"
              helpText="Leave blank to auto-generate from Elasticsearch name"
            >
              <EuiFieldText
                value={kibana.name}
                onChange={(e) => updateKibana({ name: e.target.value })}
                placeholder={`${state.elasticsearch.name}-kb`}
              />
            </EuiFormRow>

            <EuiFormRow label="Replicas">
              <EuiFieldNumber
                value={kibana.count}
                onChange={(e) =>
                  updateKibana({
                    count: parseInt(e.target.value, 10) || 1,
                  })
                }
                min={1}
              />
            </EuiFormRow>
          </>
        )}
      </EuiPanel>

      <EuiSpacer size="l" />

      <EuiFlexGroup justifyContent="spaceBetween">
        <EuiFlexItem grow={false}>
          <EuiButtonEmpty onClick={prevStep}>
            Back: Elasticsearch
          </EuiButtonEmpty>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButton fill onClick={nextStep}>
            Next: Integrations
          </EuiButton>
        </EuiFlexItem>
      </EuiFlexGroup>
    </EuiForm>
  );
}
