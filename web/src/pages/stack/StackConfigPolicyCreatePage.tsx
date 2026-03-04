import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EuiPageHeader,
  EuiSpacer,
  EuiForm,
  EuiFormRow,
  EuiFieldText,
  EuiButton,
  EuiButtonEmpty,
  EuiFlexGroup,
  EuiFlexItem,
  EuiCallOut,
  EuiPanel,
  EuiTitle,
  EuiTextArea,
} from '@elastic/eui';
import { useCreateResource } from '../../hooks/useResources';

const DEFAULT_POLICY_SPEC = `# StackConfigPolicy spec
# Define Elasticsearch and Kibana configuration settings
# that will be applied to matching resources.

elasticsearch:
  config:
    # xpack.security.enabled: true

kibana:
  config:
    # server.publicBaseUrl: "https://kibana.example.com"

# resourceSelector:
#   matchLabels:
#     environment: production
`;

export function StackConfigPolicyCreatePage() {
  const navigate = useNavigate();
  const createMutation = useCreateResource('stackconfigpolicy');
  const [name, setName] = useState('');
  const [namespace, setNamespace] = useState('default');
  const [specYaml, setSpecYaml] = useState(DEFAULT_POLICY_SPEC);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Required';
    else if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name))
      e.name = 'Invalid Kubernetes name';
    if (!namespace.trim()) e.namespace = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const parseYamlToJson = (yaml: string): Record<string, unknown> => {
    // Simple YAML-like parser for the spec fields.
    // In production this would use a full YAML parser.
    // For now, we send the raw YAML string as the spec annotation
    // and let the backend handle parsing.
    const spec: Record<string, unknown> = {};
    const lines = yaml.split('\n').filter((l) => !l.trim().startsWith('#') && l.trim());

    let currentSection = '';
    for (const line of lines) {
      const topMatch = line.match(/^(\w[\w-]*):/);
      if (topMatch) {
        currentSection = topMatch[1];
        spec[currentSection] = {};
      }
    }

    return spec;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;

    const parsedSpec = parseYamlToJson(specYaml);

    await createMutation.mutateAsync({
      apiVersion: 'stackconfigpolicy.k8s.elastic.co/v1alpha1',
      kind: 'StackConfigPolicy',
      metadata: {
        name,
        namespace,
        annotations: {
          'eck-ui/raw-spec': specYaml,
        },
      },
      spec: parsedSpec,
    });
    navigate('/stackconfigpolicy');
  };

  return (
    <>
      <EuiPageHeader pageTitle="Create Stack Config Policy" iconType="controlsHorizontal" />
      <EuiSpacer size="l" />
      {createMutation.isError && (
        <>
          <EuiCallOut title="Failed to create policy" color="danger" iconType="error">
            {createMutation.error?.message}
          </EuiCallOut>
          <EuiSpacer size="m" />
        </>
      )}
      <EuiForm component="form" onSubmit={handleSubmit}>
        <EuiPanel>
          <EuiTitle size="xs">
            <h3>General</h3>
          </EuiTitle>
          <EuiSpacer size="m" />
          <EuiFormRow
            label="Name"
            isInvalid={!!errors.name}
            error={errors.name}
          >
            <EuiFieldText
              value={name}
              onChange={(e) => setName(e.target.value)}
              isInvalid={!!errors.name}
              placeholder="my-stack-policy"
              aria-label="Policy name"
            />
          </EuiFormRow>
          <EuiFormRow
            label="Namespace"
            isInvalid={!!errors.namespace}
            error={errors.namespace}
          >
            <EuiFieldText
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              isInvalid={!!errors.namespace}
              aria-label="Namespace"
            />
          </EuiFormRow>
        </EuiPanel>

        <EuiSpacer size="l" />

        <EuiPanel>
          <EuiTitle size="xs">
            <h3>Policy Specification</h3>
          </EuiTitle>
          <EuiSpacer size="m" />
          <EuiFormRow
            label="Spec (YAML)"
            fullWidth
            helpText="Define the Elasticsearch and Kibana configuration settings for this policy"
          >
            <EuiTextArea
              value={specYaml}
              onChange={(e) => setSpecYaml(e.target.value)}
              fullWidth
              rows={16}
              style={{ fontFamily: 'monospace', fontSize: '14px' }}
              aria-label="Policy specification editor"
            />
          </EuiFormRow>
        </EuiPanel>

        <EuiSpacer size="l" />
        <EuiFlexGroup justifyContent="flexEnd">
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty onClick={() => navigate('/stackconfigpolicy')}>
              Cancel
            </EuiButtonEmpty>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButton type="submit" fill isLoading={createMutation.isPending}>
              Create Policy
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiForm>
    </>
  );
}
