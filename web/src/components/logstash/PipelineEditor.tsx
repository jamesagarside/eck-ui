import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiFormRow,
  EuiFieldText,
  EuiFieldNumber,
  EuiButton,
  EuiButtonIcon,
  EuiPanel,
  EuiSpacer,
  EuiTitle,
  EuiTextArea,
} from '@elastic/eui';

export interface PipelineConfig {
  id: string;
  config: string;
  workers: number;
}

interface PipelineEditorProps {
  pipelines: PipelineConfig[];
  onChange: (pipelines: PipelineConfig[]) => void;
}

function emptyPipeline(): PipelineConfig {
  return {
    id: '',
    config: `input {
  beats {
    port => 5044
  }
}

filter {
}

output {
  elasticsearch {
    hosts => ["https://elasticsearch-es-http:9200"]
  }
}
`,
    workers: 2,
  };
}

export function PipelineEditor({ pipelines, onChange }: PipelineEditorProps) {
  const updatePipeline = (index: number, updates: Partial<PipelineConfig>) => {
    const updated = pipelines.map((p, i) =>
      i === index ? { ...p, ...updates } : p,
    );
    onChange(updated);
  };

  const addPipeline = () => {
    onChange([...pipelines, emptyPipeline()]);
  };

  const removePipeline = (index: number) => {
    if (pipelines.length <= 1) return;
    onChange(pipelines.filter((_, i) => i !== index));
  };

  return (
    <div>
      {pipelines.map((pipeline, index) => (
        <EuiPanel key={index} paddingSize="m" hasBorder style={{ marginBottom: 16 }}>
          <EuiFlexGroup justifyContent="spaceBetween" alignItems="center">
            <EuiFlexItem grow={false}>
              <EuiTitle size="xxs">
                <h4>Pipeline {index + 1}</h4>
              </EuiTitle>
            </EuiFlexItem>
            {pipelines.length > 1 && (
              <EuiFlexItem grow={false}>
                <EuiButtonIcon
                  iconType="trash"
                  color="danger"
                  onClick={() => removePipeline(index)}
                  aria-label={`Remove pipeline ${index + 1}`}
                />
              </EuiFlexItem>
            )}
          </EuiFlexGroup>
          <EuiSpacer size="m" />

          <EuiFlexGroup>
            <EuiFlexItem>
              <EuiFormRow label="Pipeline ID" helpText="Unique identifier for this pipeline">
                <EuiFieldText
                  value={pipeline.id}
                  onChange={(e) => updatePipeline(index, { id: e.target.value })}
                  placeholder="main"
                  aria-label="Pipeline ID"
                />
              </EuiFormRow>
            </EuiFlexItem>
            <EuiFlexItem grow={false} style={{ width: 150 }}>
              <EuiFormRow label="Workers" helpText="Number of pipeline workers">
                <EuiFieldNumber
                  value={pipeline.workers}
                  onChange={(e) =>
                    updatePipeline(index, {
                      workers: parseInt(e.target.value, 10) || 1,
                    })
                  }
                  min={1}
                  max={64}
                  aria-label="Pipeline workers"
                />
              </EuiFormRow>
            </EuiFlexItem>
          </EuiFlexGroup>

          <EuiSpacer size="m" />

          <EuiFormRow label="Pipeline Configuration" fullWidth>
            <EuiTextArea
              value={pipeline.config}
              onChange={(e) => updatePipeline(index, { config: e.target.value })}
              fullWidth
              rows={12}
              style={{ fontFamily: 'monospace', fontSize: '14px' }}
              aria-label="Pipeline configuration editor"
            />
          </EuiFormRow>
        </EuiPanel>
      ))}

      <EuiButton iconType="plusInCircle" onClick={addPipeline} size="s">
        Add Pipeline
      </EuiButton>
    </div>
  );
}

export function pipelineConfigsToSpec(configs: PipelineConfig[]) {
  return configs
    .filter((p) => p.id.trim())
    .map((p) => ({
      pipeline: {
        id: p.id,
        config: p.config,
        workers: p.workers,
      },
    }));
}

export function specToPipelineConfigs(
  pipelines?: { pipeline: { id: string; config?: string; workers?: number } }[],
): PipelineConfig[] {
  if (!pipelines || pipelines.length === 0) {
    return [emptyPipeline()];
  }
  return pipelines.map((p) => ({
    id: p.pipeline.id,
    config: p.pipeline.config || '',
    workers: p.pipeline.workers || 2,
  }));
}
