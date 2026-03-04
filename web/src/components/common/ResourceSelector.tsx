import { useMemo } from 'react';
import {
  EuiComboBox,
  type EuiComboBoxOptionOption,
} from '@elastic/eui';
import { useResourceList } from '../../hooks/useResources';
import type { ResourceType, BaseResource } from '../../types/resources';

interface ResourceRef {
  name: string;
  namespace?: string;
}

interface ResourceSelectorProps {
  resourceType: Extract<ResourceType, 'elasticsearch' | 'kibana'>;
  value: ResourceRef | null;
  onChange: (ref: ResourceRef | null) => void;
  namespace?: string;
  isInvalid?: boolean;
}

export function ResourceSelector({
  resourceType,
  value,
  onChange,
  namespace,
  isInvalid,
}: ResourceSelectorProps) {
  const { data, isLoading } = useResourceList<BaseResource>(resourceType);

  const options: EuiComboBoxOptionOption<ResourceRef>[] = useMemo(() => {
    const items = data?.items ?? [];
    const filtered = namespace
      ? items.filter((item) => item.metadata.namespace === namespace)
      : items;

    return filtered.map((item) => ({
      label: `${item.metadata.name} (${item.metadata.namespace})`,
      value: {
        name: item.metadata.name,
        namespace: item.metadata.namespace,
      },
    }));
  }, [data, namespace]);

  const selectedOptions: EuiComboBoxOptionOption<ResourceRef>[] = useMemo(() => {
    if (!value) return [];
    const match = options.find(
      (opt) =>
        opt.value?.name === value.name &&
        (value.namespace ? opt.value?.namespace === value.namespace : true),
    );
    return match ? [match] : [];
  }, [value, options]);

  const handleChange = (selected: EuiComboBoxOptionOption<ResourceRef>[]) => {
    if (selected.length === 0) {
      onChange(null);
      return;
    }
    const chosen = selected[0];
    if (chosen.value) {
      onChange({
        name: chosen.value.name,
        namespace: chosen.value.namespace,
      });
    }
  };

  const label =
    resourceType === 'elasticsearch'
      ? 'Elasticsearch Reference'
      : 'Kibana Reference';

  return (
    <EuiComboBox
      aria-label={label}
      placeholder={`Select ${resourceType}...`}
      options={options}
      selectedOptions={selectedOptions}
      onChange={handleChange}
      singleSelection={{ asPlainText: true }}
      isLoading={isLoading}
      isInvalid={isInvalid}
      isClearable
      fullWidth
    />
  );
}
