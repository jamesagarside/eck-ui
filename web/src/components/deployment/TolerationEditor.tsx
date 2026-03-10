import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiFormRow,
  EuiFieldText,
  EuiSelect,
  EuiButtonEmpty,
  EuiButtonIcon,
} from '@elastic/eui';
import type { TolerationIntent } from '../../hooks/useDeploymentMutations';

const OPERATOR_OPTIONS = [
  { value: 'Equal', text: 'Equal' },
  { value: 'Exists', text: 'Exists' },
];

const EFFECT_OPTIONS = [
  { value: '', text: 'All effects' },
  { value: 'NoSchedule', text: 'NoSchedule' },
  { value: 'NoExecute', text: 'NoExecute' },
  { value: 'PreferNoSchedule', text: 'PreferNoSchedule' },
];

interface TolerationEditorProps {
  tolerations: TolerationIntent[];
  onChange: (tolerations: TolerationIntent[]) => void;
  readOnly?: boolean;
}

function emptyToleration(): TolerationIntent {
  return { key: '', operator: 'Equal', value: '', effect: '' };
}

export function TolerationEditor({
  tolerations,
  onChange,
  readOnly = false,
}: TolerationEditorProps) {
  const update = (index: number, updates: Partial<TolerationIntent>) => {
    const updated = tolerations.map((t, i) =>
      i === index ? { ...t, ...updates } : t,
    );
    // Clear value when switching to Exists operator
    if (updates.operator === 'Exists') {
      updated[index] = { ...updated[index], value: '' };
    }
    onChange(updated);
  };

  const add = () => {
    onChange([...tolerations, emptyToleration()]);
  };

  const remove = (index: number) => {
    onChange(tolerations.filter((_, i) => i !== index));
  };

  return (
    <div>
      {tolerations.map((toleration, index) => (
        <EuiFlexGroup
          key={index}
          gutterSize="s"
          alignItems="center"
          responsive={false}
          style={{ marginBottom: 8 }}
        >
          <EuiFlexItem>
            <EuiFormRow label={index === 0 ? 'Key' : undefined}>
              <EuiFieldText
                value={toleration.key}
                onChange={(e) => update(index, { key: e.target.value })}
                placeholder="key"
                readOnly={readOnly}
                aria-label="Toleration key"
                compressed
              />
            </EuiFormRow>
          </EuiFlexItem>
          <EuiFlexItem grow={false} style={{ width: 120 }}>
            <EuiFormRow label={index === 0 ? 'Operator' : undefined}>
              <EuiSelect
                options={OPERATOR_OPTIONS}
                value={toleration.operator}
                onChange={(e) =>
                  update(index, {
                    operator: e.target.value as TolerationIntent['operator'],
                  })
                }
                disabled={readOnly}
                aria-label="Toleration operator"
                compressed
              />
            </EuiFormRow>
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiFormRow label={index === 0 ? 'Value' : undefined}>
              <EuiFieldText
                value={toleration.value ?? ''}
                onChange={(e) => update(index, { value: e.target.value })}
                placeholder="value"
                disabled={toleration.operator === 'Exists'}
                readOnly={readOnly}
                aria-label="Toleration value"
                compressed
              />
            </EuiFormRow>
          </EuiFlexItem>
          <EuiFlexItem grow={false} style={{ width: 180 }}>
            <EuiFormRow label={index === 0 ? 'Effect' : undefined}>
              <EuiSelect
                options={EFFECT_OPTIONS}
                value={toleration.effect}
                onChange={(e) =>
                  update(index, {
                    effect: e.target.value as TolerationIntent['effect'],
                  })
                }
                disabled={readOnly}
                aria-label="Toleration effect"
                compressed
              />
            </EuiFormRow>
          </EuiFlexItem>
          {!readOnly && (
            <EuiFlexItem grow={false}>
              <EuiFormRow
                label={index === 0 ? '\u00A0' : undefined}
              >
                <EuiButtonIcon
                  iconType="trash"
                  color="danger"
                  onClick={() => remove(index)}
                  aria-label={`Remove toleration ${index + 1}`}
                />
              </EuiFormRow>
            </EuiFlexItem>
          )}
        </EuiFlexGroup>
      ))}

      {!readOnly && (
        <EuiButtonEmpty
          iconType="plusInCircle"
          onClick={add}
          size="s"
        >
          Add toleration
        </EuiButtonEmpty>
      )}
    </div>
  );
}
