import { useMemo } from 'react';
import {
  EuiPanel,
  EuiFlexGroup,
  EuiFlexItem,
  EuiTitle,
  EuiCopy,
  EuiButtonIcon,
  EuiSpacer,
} from '@elastic/eui';
import { stringify } from 'yaml';
import { YamlEditor } from './YamlEditor';

interface ManifestViewerProps {
  /** The resource object to display as YAML */
  resource: unknown;
  /** Title shown above the viewer */
  title?: string;
  /** Height of the YAML editor */
  height?: string;
}

export function ManifestViewer({
  resource,
  title = 'Manifest',
  height = '500px',
}: ManifestViewerProps) {
  const yamlText = useMemo(
    () => stringify(resource, { lineWidth: 0 }),
    [resource],
  );

  return (
    <EuiPanel>
      <EuiFlexGroup alignItems="center" justifyContent="spaceBetween" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiTitle size="xs"><h3>{title}</h3></EuiTitle>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiCopy textToCopy={yamlText}>
            {(copy) => (
              <EuiButtonIcon
                onClick={copy}
                iconType="copy"
                aria-label="Copy manifest to clipboard"
                title="Copy to clipboard"
              />
            )}
          </EuiCopy>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="s" />
      <YamlEditor value={yamlText} readOnly height={height} />
    </EuiPanel>
  );
}
