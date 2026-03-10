import { useCallback, useMemo } from 'react';
import {
  EuiAccordion,
  EuiFormRow,
  EuiSpacer,
} from '@elastic/eui';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { PodTemplateIntent } from '../../hooks/useDeploymentMutations';
import { NodeSelectorEditor } from './NodeSelectorEditor';
import { TolerationEditor } from './TolerationEditor';
import { YamlEditor } from '../common/YamlEditor';

interface PodSchedulingSectionProps {
  podTemplate: PodTemplateIntent;
  onChange: (podTemplate: PodTemplateIntent) => void;
  readOnly?: boolean;
}

export function PodSchedulingSection({
  podTemplate,
  onChange,
  readOnly = false,
}: PodSchedulingSectionProps) {
  const affinityYaml = useMemo(
    () =>
      podTemplate.affinity && Object.keys(podTemplate.affinity).length > 0
        ? stringifyYaml(podTemplate.affinity, { lineWidth: 0 })
        : '',
    [podTemplate.affinity],
  );

  const handleNodeSelectorChange = useCallback(
    (nodeSelector: Record<string, string>) => {
      onChange({
        ...podTemplate,
        nodeSelector:
          Object.keys(nodeSelector).length > 0 ? nodeSelector : undefined,
      });
    },
    [podTemplate, onChange],
  );

  const handleTolerationsChange = useCallback(
    (tolerations: PodTemplateIntent['tolerations']) => {
      onChange({
        ...podTemplate,
        tolerations: tolerations && tolerations.length > 0 ? tolerations : undefined,
      });
    },
    [podTemplate, onChange],
  );

  const handleAffinityChange = useCallback(
    (value: string) => {
      if (value.trim() === '') {
        onChange({ ...podTemplate, affinity: undefined });
        return;
      }
      try {
        const parsed = parseYaml(value) as Record<string, unknown>;
        onChange({ ...podTemplate, affinity: parsed });
      } catch {
        // YamlEditor shows validation errors; don't update until valid
      }
    },
    [podTemplate, onChange],
  );

  return (
    <div>
      <EuiFormRow label="Node Selectors" fullWidth>
        <NodeSelectorEditor
          nodeSelector={podTemplate.nodeSelector ?? {}}
          onChange={handleNodeSelectorChange}
          readOnly={readOnly}
        />
      </EuiFormRow>

      <EuiSpacer size="m" />

      <EuiFormRow label="Tolerations" fullWidth>
        <TolerationEditor
          tolerations={podTemplate.tolerations ?? []}
          onChange={handleTolerationsChange}
          readOnly={readOnly}
        />
      </EuiFormRow>

      <EuiSpacer size="m" />

      <EuiAccordion
        id="affinity-advanced"
        buttonContent="Affinity (Advanced)"
        paddingSize="m"
      >
        <YamlEditor
          value={affinityYaml}
          onChange={readOnly ? undefined : handleAffinityChange}
          readOnly={readOnly}
          height="200px"
        />
      </EuiAccordion>
    </div>
  );
}
