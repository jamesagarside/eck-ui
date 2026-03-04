import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiFormRow,
  EuiFieldText,
  EuiButton,
  EuiButtonIcon,
  EuiPanel,
  EuiSpacer,
  EuiTitle,
} from '@elastic/eui';

export interface ElasticsearchRef {
  outputName: string;
  name: string;
  namespace: string;
}

interface ElasticsearchRefsEditorProps {
  refs: ElasticsearchRef[];
  onChange: (refs: ElasticsearchRef[]) => void;
}

function emptyRef(): ElasticsearchRef {
  return {
    outputName: '',
    name: '',
    namespace: '',
  };
}

export function ElasticsearchRefsEditor({ refs, onChange }: ElasticsearchRefsEditorProps) {
  const updateRef = (index: number, updates: Partial<ElasticsearchRef>) => {
    const updated = refs.map((ref, i) =>
      i === index ? { ...ref, ...updates } : ref,
    );
    onChange(updated);
  };

  const addRef = () => {
    onChange([...refs, emptyRef()]);
  };

  const removeRef = (index: number) => {
    onChange(refs.filter((_, i) => i !== index));
  };

  return (
    <div>
      {refs.map((ref, index) => (
        <EuiPanel key={index} paddingSize="m" hasBorder style={{ marginBottom: 16 }}>
          <EuiFlexGroup justifyContent="spaceBetween" alignItems="center">
            <EuiFlexItem grow={false}>
              <EuiTitle size="xxs">
                <h4>Elasticsearch Output {index + 1}</h4>
              </EuiTitle>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButtonIcon
                iconType="trash"
                color="danger"
                onClick={() => removeRef(index)}
                aria-label={`Remove Elasticsearch output ${index + 1}`}
              />
            </EuiFlexItem>
          </EuiFlexGroup>
          <EuiSpacer size="m" />

          <EuiFlexGroup>
            <EuiFlexItem>
              <EuiFormRow
                label="Output Name"
                helpText="Identifier for this output in the Agent policy"
              >
                <EuiFieldText
                  value={ref.outputName}
                  onChange={(e) => updateRef(index, { outputName: e.target.value })}
                  placeholder="e.g. default, monitoring"
                  aria-label="Output name"
                />
              </EuiFormRow>
            </EuiFlexItem>
            <EuiFlexItem>
              <EuiFormRow
                label="Elasticsearch Cluster Name"
                helpText="Name of the Elasticsearch resource"
              >
                <EuiFieldText
                  value={ref.name}
                  onChange={(e) => updateRef(index, { name: e.target.value })}
                  placeholder="my-elasticsearch"
                  aria-label="Elasticsearch cluster name"
                />
              </EuiFormRow>
            </EuiFlexItem>
            <EuiFlexItem>
              <EuiFormRow
                label="Namespace (optional)"
                helpText="Namespace of the Elasticsearch resource"
              >
                <EuiFieldText
                  value={ref.namespace}
                  onChange={(e) => updateRef(index, { namespace: e.target.value })}
                  placeholder="default"
                  aria-label="Elasticsearch namespace"
                />
              </EuiFormRow>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiPanel>
      ))}

      <EuiButton iconType="plusInCircle" onClick={addRef} size="s">
        Add Elasticsearch Output
      </EuiButton>
    </div>
  );
}

export function refsToSpec(refs: ElasticsearchRef[]) {
  return refs
    .filter((ref) => ref.name.trim())
    .map((ref) => ({
      outputName: ref.outputName || undefined,
      name: ref.name,
      ...(ref.namespace ? { namespace: ref.namespace } : {}),
    }));
}

export function specToRefs(
  elasticsearchRefs?: { name: string; namespace?: string; outputName?: string }[],
): ElasticsearchRef[] {
  if (!elasticsearchRefs || elasticsearchRefs.length === 0) {
    return [emptyRef()];
  }
  return elasticsearchRefs.map((ref) => ({
    outputName: ref.outputName || '',
    name: ref.name,
    namespace: ref.namespace || '',
  }));
}
