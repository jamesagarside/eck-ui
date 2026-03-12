import { EuiSelect, EuiFieldText } from '@elastic/eui';
import { useVersions } from '../../hooks/useVersions';

interface VersionSelectProps {
  value: string;
  onChange: (version: string) => void;
  currentVersion?: string;
  isInvalid?: boolean;
}

export function VersionSelect({ value, onChange, currentVersion, isInvalid }: VersionSelectProps) {
  const { versions, isLoading } = useVersions();

  if (!isLoading && versions.length === 0) {
    return (
      <EuiFieldText
        value={value}
        onChange={(e) => onChange(e.target.value)}
        isInvalid={isInvalid}
      />
    );
  }

  const options = versions.map((v) => ({ value: v.value, text: v.label }));

  if (currentVersion && !options.some((o) => o.value === currentVersion)) {
    options.unshift({ value: currentVersion, text: `${currentVersion} (current)` });
  }

  if (options.length === 0) {
    options.push({ value: value || '8.17.0', text: value || '8.17.0' });
  }

  return (
    <EuiSelect
      options={options}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      isLoading={isLoading}
      isInvalid={isInvalid}
    />
  );
}
