// Step 2: Kibana Configuration
import {
  EuiForm,
  EuiFormRow,
  EuiFieldText,
  EuiFieldNumber,
  EuiSwitch,
  EuiSpacer,
  EuiPanel,
  EuiTitle,
  EuiText,
  EuiFlexGroup,
  EuiFlexItem,
  EuiCallOut,
} from '@elastic/eui';
import { useWizard } from './WizardContext';

export function KibanaStep() {
  const { state, toggleKibana, updateKibana } = useWizard();
  const { kibana, elasticsearch } = state;

  return (
    <EuiForm>
      <EuiPanel>
        <EuiFlexGroup alignItems="center" justifyContent="spaceBetween">
          <EuiFlexItem>
            <EuiTitle size="xs">
              <h3>Enable Kibana</h3>
            </EuiTitle>
            <EuiText size="s" color="subdued">
              Deploy Kibana for visualization, dashboards and cluster management
            </EuiText>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiSwitch
              label=""
              checked={!!kibana}
              onChange={(e) => toggleKibana(e.target.checked)}
            />
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiPanel>

      {kibana && (
        <>
          <EuiSpacer size="l" />

          <EuiPanel>
            <EuiTitle size="xs">
              <h3>Kibana Settings</h3>
            </EuiTitle>
            <EuiSpacer size="m" />

            <EuiCallOut title="Automatic Association" iconType="link" size="s">
              <p>
                Kibana will be automatically associated with your Elasticsearch cluster
                <strong> {elasticsearch.name || '(name pending)'}</strong>
              </p>
            </EuiCallOut>

            <EuiSpacer size="m" />

            <EuiFlexGroup>
              <EuiFlexItem>
                <EuiFormRow
                  label="Instance Name"
                  helpText="Leave empty to auto-generate from Elasticsearch name"
                >
                  <EuiFieldText
                    value={kibana.name}
                    onChange={(e) => updateKibana({ name: e.target.value })}
                    placeholder={elasticsearch.name ? `${elasticsearch.name}-kb` : 'my-kibana'}
                  />
                </EuiFormRow>
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiFormRow label="Replica Count" helpText="Number of Kibana pods">
                  <EuiFieldNumber
                    value={kibana.count}
                    min={1}
                    max={10}
                    onChange={(e) => updateKibana({ count: parseInt(e.target.value) || 1 })}
                  />
                </EuiFormRow>
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiPanel>

          <EuiSpacer size="l" />

          <EuiPanel color="subdued">
            <EuiTitle size="xs">
              <h3>Kibana Features</h3>
            </EuiTitle>
            <EuiSpacer size="m" />
            <EuiText size="s">
              <p>Once deployed, Kibana provides:</p>
              <ul>
                <li>Search and visualization dashboards</li>
                <li>Dev Tools console for Elasticsearch queries</li>
                <li>Stack Monitoring for cluster health</li>
                <li>Fleet management for Elastic Agent</li>
                <li>Observability, Security, and other solutions</li>
              </ul>
            </EuiText>
          </EuiPanel>
        </>
      )}

      {!kibana && (
        <>
          <EuiSpacer size="l" />
          <EuiCallOut
            title="Kibana is optional but recommended"
            iconType="iInCircle"
            color="primary"
          >
            <p>
              While Kibana is optional, it provides essential features for managing your
              Elasticsearch cluster, creating visualizations, and setting up Fleet for Elastic
              Agent. You can always add it later.
            </p>
          </EuiCallOut>
        </>
      )}
    </EuiForm>
  );
}
