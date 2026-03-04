import {
  EuiForm,
  EuiFormRow,
  EuiFieldText,
  EuiSpacer,
  EuiButton,
  EuiPanel,
  EuiTitle,
} from '@elastic/eui';
import {
  NodeSetEditor,
  type NodeSetConfig,
} from '../../components/elasticsearch/NodeSetEditor';
import { useWizard } from './WizardContext';

export function ElasticsearchStep() {
  const { state, updateElasticsearch, nextStep } = useWizard();
  const { elasticsearch } = state;

  const canProceed =
    elasticsearch.name.trim() !== '' &&
    elasticsearch.namespace.trim() !== '' &&
    elasticsearch.version.trim() !== '' &&
    elasticsearch.nodeSets.length > 0 &&
    elasticsearch.nodeSets.every((ns) => ns.name.trim() !== '');

  return (
    <EuiForm>
      <EuiPanel>
        <EuiTitle size="xs">
          <h3>Elasticsearch Configuration</h3>
        </EuiTitle>
        <EuiSpacer size="m" />

        <EuiFormRow label="Cluster Name" helpText="Must be a valid Kubernetes name">
          <EuiFieldText
            value={elasticsearch.name}
            onChange={(e) => updateElasticsearch({ name: e.target.value })}
            placeholder="my-elasticsearch"
          />
        </EuiFormRow>

        <EuiFormRow label="Namespace">
          <EuiFieldText
            value={elasticsearch.namespace}
            onChange={(e) =>
              updateElasticsearch({ namespace: e.target.value })
            }
          />
        </EuiFormRow>

        <EuiFormRow label="Version">
          <EuiFieldText
            value={elasticsearch.version}
            onChange={(e) =>
              updateElasticsearch({ version: e.target.value })
            }
          />
        </EuiFormRow>
      </EuiPanel>

      <EuiSpacer size="l" />

      <EuiPanel>
        <EuiTitle size="xs">
          <h3>NodeSets</h3>
        </EuiTitle>
        <EuiSpacer size="m" />
        <NodeSetEditor
          nodeSets={elasticsearch.nodeSets}
          onChange={(nodeSets: NodeSetConfig[]) =>
            updateElasticsearch({ nodeSets })
          }
        />
      </EuiPanel>

      <EuiSpacer size="l" />
      <EuiButton fill onClick={nextStep} disabled={!canProceed}>
        Next: Kibana
      </EuiButton>
    </EuiForm>
  );
}
