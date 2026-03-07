import { useState, useCallback, useMemo } from 'react';
import {
  EuiPanel,
  EuiTitle,
  EuiSpacer,
  EuiFlexGroup,
  EuiFlexItem,
  EuiButton,
  EuiButtonEmpty,
  EuiCallOut,
} from '@elastic/eui';
import { stringify, parse as parseYaml } from 'yaml';
import { YamlEditor } from './YamlEditor';

interface UserSettingsEditorProps {
  /** The current config object from the resource spec */
  config: Record<string, unknown> | undefined;
  /** Called with the parsed config object when the user saves */
  onSave: (config: Record<string, unknown>) => Promise<void>;
  /** Title for the panel */
  title?: string;
}

export function UserSettingsEditor({
  config,
  onSave,
  title = 'User Settings',
}: UserSettingsEditorProps) {
  const initialYaml = useMemo(
    () => (config && Object.keys(config).length > 0 ? stringify(config, { lineWidth: 0 }) : ''),
    [config],
  );

  const [value, setValue] = useState(initialYaml);
  const [parseError, setParseError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isDirty = value !== initialYaml;

  const handleChange = useCallback((newValue: string) => {
    setValue(newValue);
    setSaved(false);
    setSaveError(null);
    if (newValue.trim() === '') {
      setParseError(null);
      return;
    }
    try {
      parseYaml(newValue);
      setParseError(null);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Invalid YAML');
    }
  }, []);

  const handleSave = async () => {
    setSaveError(null);
    setIsSaving(true);
    try {
      const parsed = value.trim() === '' ? {} : (parseYaml(value) as Record<string, unknown>);
      await onSave(parsed);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setValue(initialYaml);
    setParseError(null);
    setSaveError(null);
    setSaved(false);
  };

  return (
    <EuiPanel>
      <EuiTitle size="xs"><h3>{title}</h3></EuiTitle>
      <EuiSpacer size="s" />

      {saveError && (
        <>
          <EuiCallOut title="Save failed" color="danger" iconType="error" size="s">
            {saveError}
          </EuiCallOut>
          <EuiSpacer size="s" />
        </>
      )}

      {saved && !isDirty && (
        <>
          <EuiCallOut title="Settings saved successfully" color="success" iconType="check" size="s" />
          <EuiSpacer size="s" />
        </>
      )}

      <YamlEditor value={value} onChange={handleChange} height="250px" />
      <EuiSpacer size="m" />

      <EuiFlexGroup gutterSize="s" justifyContent="flexEnd">
        <EuiFlexItem grow={false}>
          <EuiButtonEmpty
            onClick={handleDiscard}
            disabled={!isDirty}
            size="s"
          >
            Discard
          </EuiButtonEmpty>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButton
            onClick={handleSave}
            fill
            size="s"
            isLoading={isSaving}
            disabled={!!parseError || !isDirty}
          >
            Save
          </EuiButton>
        </EuiFlexItem>
      </EuiFlexGroup>
    </EuiPanel>
  );
}
