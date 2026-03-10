import { useCallback, useMemo } from 'react';
import { EuiFormRow } from '@elastic/eui';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { YamlEditor } from '../common/YamlEditor';

interface UserSettingsSectionProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  componentType: string;
  readOnly?: boolean;
}

const CONFIG_FILE_NAMES: Record<string, string> = {
  elasticsearch: 'elasticsearch.yml',
  kibana: 'kibana.yml',
  apm: 'apm-server.yml',
  logstash: 'logstash.yml',
  beat: '{type}.yml',
  agent: 'elastic-agent.yml',
  'enterprise-search': 'enterprise-search.yml',
  maps: 'elastic-maps-server.yml',
};

function getConfigFileName(componentType: string): string {
  return CONFIG_FILE_NAMES[componentType] ?? `${componentType}.yml`;
}

export function UserSettingsSection({
  config,
  onChange,
  componentType,
  readOnly = false,
}: UserSettingsSectionProps) {
  const configFileName = getConfigFileName(componentType);

  const yamlValue = useMemo(
    () =>
      config && Object.keys(config).length > 0
        ? stringifyYaml(config, { lineWidth: 0 })
        : '',
    [config],
  );

  const handleChange = useCallback(
    (value: string) => {
      if (value.trim() === '') {
        onChange({});
        return;
      }
      try {
        const parsed = parseYaml(value) as Record<string, unknown>;
        onChange(parsed);
      } catch {
        // YamlEditor handles validation display; don't update until valid
      }
    },
    [onChange],
  );

  return (
    <EuiFormRow label={`User Settings (${configFileName})`} fullWidth>
      <YamlEditor
        value={yamlValue}
        onChange={readOnly ? undefined : handleChange}
        readOnly={readOnly}
        height="200px"
      />
    </EuiFormRow>
  );
}
