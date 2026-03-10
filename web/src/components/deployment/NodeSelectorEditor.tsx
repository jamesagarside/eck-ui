import { useState, useCallback, useEffect } from 'react';
import {
  EuiButtonEmpty,
  EuiButtonIcon,
  EuiFieldText,
  EuiFlexGroup,
  EuiFlexItem,
} from '@elastic/eui';

interface NodeSelectorEditorProps {
  nodeSelector: Record<string, string>;
  onChange: (nodeSelector: Record<string, string>) => void;
  readOnly?: boolean;
}

interface SelectorEntry {
  key: string;
  value: string;
}

function toEntries(record: Record<string, string>): SelectorEntry[] {
  const entries = Object.entries(record).map(([key, value]) => ({
    key,
    value,
  }));
  return entries.length > 0 ? entries : [];
}

function toRecord(entries: SelectorEntry[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (const entry of entries) {
    if (entry.key !== '') {
      record[entry.key] = entry.value;
    }
  }
  return record;
}

export function NodeSelectorEditor({
  nodeSelector,
  onChange,
  readOnly = false,
}: NodeSelectorEditorProps) {
  const [entries, setEntries] = useState<SelectorEntry[]>(() =>
    toEntries(nodeSelector),
  );

  useEffect(() => {
    setEntries(toEntries(nodeSelector));
  }, [nodeSelector]);

  const emitChange = useCallback(
    (updated: SelectorEntry[]) => {
      setEntries(updated);
      onChange(toRecord(updated));
    },
    [onChange],
  );

  const handleKeyChange = useCallback(
    (index: number, newKey: string) => {
      const updated = entries.map((entry, i) =>
        i === index ? { ...entry, key: newKey } : entry,
      );
      emitChange(updated);
    },
    [entries, emitChange],
  );

  const handleValueChange = useCallback(
    (index: number, newValue: string) => {
      const updated = entries.map((entry, i) =>
        i === index ? { ...entry, value: newValue } : entry,
      );
      emitChange(updated);
    },
    [entries, emitChange],
  );

  const handleRemove = useCallback(
    (index: number) => {
      const updated = entries.filter((_, i) => i !== index);
      emitChange(updated);
    },
    [entries, emitChange],
  );

  const handleAdd = useCallback(() => {
    const updated = [...entries, { key: '', value: '' }];
    setEntries(updated);
  }, [entries]);

  return (
    <div>
      {entries.map((entry, index) => (
        <EuiFlexGroup
          key={index}
          gutterSize="s"
          alignItems="center"
          responsive={false}
          css={{ marginBottom: 4 }}
        >
          <EuiFlexItem>
            <EuiFieldText
              placeholder="Key"
              value={entry.key}
              onChange={(e) => handleKeyChange(index, e.target.value)}
              readOnly={readOnly}
              aria-label={`Node selector key ${index + 1}`}
              compressed
            />
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiFieldText
              placeholder="Value"
              value={entry.value}
              onChange={(e) => handleValueChange(index, e.target.value)}
              readOnly={readOnly}
              aria-label={`Node selector value ${index + 1}`}
              compressed
            />
          </EuiFlexItem>
          {!readOnly && (
            <EuiFlexItem grow={false}>
              <EuiButtonIcon
                iconType="trash"
                color="danger"
                onClick={() => handleRemove(index)}
                aria-label={`Remove node selector ${entry.key || index + 1}`}
              />
            </EuiFlexItem>
          )}
        </EuiFlexGroup>
      ))}
      {!readOnly && (
        <EuiButtonEmpty
          size="s"
          iconType="plusInCircle"
          onClick={handleAdd}
        >
          Add selector
        </EuiButtonEmpty>
      )}
    </div>
  );
}
