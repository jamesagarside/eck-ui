import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { render } from '../../../test/utils';
import { ResourceSizingFields } from '../ResourceSizingFields';
import { NodeSelectorEditor } from '../NodeSelectorEditor';
import { TolerationEditor } from '../TolerationEditor';
import type {
  ResourcesIntent,
  TolerationIntent,
} from '../../../hooks/useDeploymentMutations';

// ---------------------------------------------------------------------------
// ResourceSizingFields
// ---------------------------------------------------------------------------
describe('ResourceSizingFields', () => {
  const defaultResources: ResourcesIntent = {
    memoryRequest: '2Gi',
    memoryLimit: '4Gi',
    cpuRequest: '500m',
    cpuLimit: '2',
  };

  it('renders all four resource fields', () => {
    const onChange = vi.fn();
    render(
      <ResourceSizingFields
        resources={defaultResources}
        onChange={onChange}
      />,
    );

    expect(screen.getByText('Memory Request')).toBeInTheDocument();
    expect(screen.getByText('Memory Limit')).toBeInTheDocument();
    expect(screen.getByText('CPU Request')).toBeInTheDocument();
    expect(screen.getByText('CPU Limit')).toBeInTheDocument();
  });

  it('displays the provided resource values in each input', () => {
    const onChange = vi.fn();
    render(
      <ResourceSizingFields
        resources={defaultResources}
        onChange={onChange}
      />,
    );

    expect(screen.getByDisplayValue('2Gi')).toBeInTheDocument();
    expect(screen.getByDisplayValue('4Gi')).toBeInTheDocument();
    expect(screen.getByDisplayValue('500m')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
  });

  it('calls onChange with updated resources when a field value changes', () => {
    const onChange = vi.fn();
    render(
      <ResourceSizingFields
        resources={defaultResources}
        onChange={onChange}
      />,
    );

    const memoryRequestInput = screen.getByDisplayValue('2Gi');
    fireEvent.change(memoryRequestInput, { target: { value: '8Gi' } });

    expect(onChange).toHaveBeenCalledWith({
      ...defaultResources,
      memoryRequest: '8Gi',
    });
  });

  it('sets the field value to undefined when cleared', () => {
    const onChange = vi.fn();
    render(
      <ResourceSizingFields
        resources={defaultResources}
        onChange={onChange}
      />,
    );

    const cpuInput = screen.getByDisplayValue('500m');
    fireEvent.change(cpuInput, { target: { value: '' } });

    expect(onChange).toHaveBeenCalledWith({
      ...defaultResources,
      cpuRequest: undefined,
    });
  });

  it('shows validation errors for invalid resource format', () => {
    const onChange = vi.fn();
    render(
      <ResourceSizingFields
        resources={defaultResources}
        onChange={onChange}
      />,
    );

    const memoryInput = screen.getByDisplayValue('2Gi');
    fireEvent.change(memoryInput, { target: { value: 'invalid!' } });

    expect(
      screen.getByText('Invalid format (e.g. 2Gi, 500m)'),
    ).toBeInTheDocument();
  });

  it('renders inputs as readOnly when readOnly prop is true', () => {
    const onChange = vi.fn();
    render(
      <ResourceSizingFields
        resources={defaultResources}
        onChange={onChange}
        readOnly
      />,
    );

    const inputs = screen.getAllByRole('textbox');
    for (const input of inputs) {
      expect(input).toHaveAttribute('readOnly');
    }
  });

  it('renders with empty resources without crashing', () => {
    const onChange = vi.fn();
    render(
      <ResourceSizingFields resources={{}} onChange={onChange} />,
    );

    expect(screen.getByText('Memory Request')).toBeInTheDocument();
    // All inputs should be empty (placeholder only)
    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(4);
    for (const input of inputs) {
      expect(input).toHaveValue('');
    }
  });
});

// ---------------------------------------------------------------------------
// NodeSelectorEditor
// ---------------------------------------------------------------------------
describe('NodeSelectorEditor', () => {
  const existingSelectors: Record<string, string> = {
    'kubernetes.io/os': 'linux',
    'node-type': 'hot',
  };

  it('renders existing selector entries', () => {
    const onChange = vi.fn();
    render(
      <NodeSelectorEditor
        nodeSelector={existingSelectors}
        onChange={onChange}
      />,
    );

    expect(screen.getByDisplayValue('kubernetes.io/os')).toBeInTheDocument();
    expect(screen.getByDisplayValue('linux')).toBeInTheDocument();
    expect(screen.getByDisplayValue('node-type')).toBeInTheDocument();
    expect(screen.getByDisplayValue('hot')).toBeInTheDocument();
  });

  it('renders an "Add selector" button', () => {
    const onChange = vi.fn();
    render(
      <NodeSelectorEditor nodeSelector={{}} onChange={onChange} />,
    );

    expect(
      screen.getByRole('button', { name: /add selector/i }),
    ).toBeInTheDocument();
  });

  it('adds a new empty entry when "Add selector" is clicked', () => {
    const onChange = vi.fn();
    render(
      <NodeSelectorEditor nodeSelector={{}} onChange={onChange} />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /add selector/i }),
    );

    // After adding, two new inputs should appear (key + value)
    expect(
      screen.getByLabelText('Node selector key 1'),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Node selector value 1'),
    ).toBeInTheDocument();
  });

  it('calls onChange with updated record when a key is edited', () => {
    const onChange = vi.fn();
    render(
      <NodeSelectorEditor
        nodeSelector={existingSelectors}
        onChange={onChange}
      />,
    );

    const keyInput = screen.getByDisplayValue('node-type');
    fireEvent.change(keyInput, { target: { value: 'disk-type' } });

    expect(onChange).toHaveBeenCalledWith({
      'kubernetes.io/os': 'linux',
      'disk-type': 'hot',
    });
  });

  it('calls onChange with updated record when a value is edited', () => {
    const onChange = vi.fn();
    render(
      <NodeSelectorEditor
        nodeSelector={existingSelectors}
        onChange={onChange}
      />,
    );

    const valueInput = screen.getByDisplayValue('hot');
    fireEvent.change(valueInput, { target: { value: 'warm' } });

    expect(onChange).toHaveBeenCalledWith({
      'kubernetes.io/os': 'linux',
      'node-type': 'warm',
    });
  });

  it('removes an entry when the trash button is clicked', () => {
    const onChange = vi.fn();
    render(
      <NodeSelectorEditor
        nodeSelector={existingSelectors}
        onChange={onChange}
      />,
    );

    // Remove the first selector (kubernetes.io/os)
    const removeButton = screen.getByLabelText(
      'Remove node selector kubernetes.io/os',
    );
    fireEvent.click(removeButton);

    expect(onChange).toHaveBeenCalledWith({
      'node-type': 'hot',
    });
  });

  it('hides add and remove controls when readOnly is true', () => {
    const onChange = vi.fn();
    render(
      <NodeSelectorEditor
        nodeSelector={existingSelectors}
        onChange={onChange}
        readOnly
      />,
    );

    expect(
      screen.queryByRole('button', { name: /add selector/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/remove node selector/i),
    ).not.toBeInTheDocument();
  });

  it('renders nothing when given an empty selector', () => {
    const onChange = vi.fn();
    render(
      <NodeSelectorEditor nodeSelector={{}} onChange={onChange} />,
    );

    // No key/value inputs should be present initially
    expect(
      screen.queryByLabelText(/node selector key/i),
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// TolerationEditor
// ---------------------------------------------------------------------------
describe('TolerationEditor', () => {
  const existingTolerations: TolerationIntent[] = [
    {
      key: 'dedicated',
      operator: 'Equal',
      value: 'elasticsearch',
      effect: 'NoSchedule',
    },
    {
      key: 'node.kubernetes.io/not-ready',
      operator: 'Exists',
      value: '',
      effect: 'NoExecute',
    },
  ];

  it('renders all provided tolerations', () => {
    const onChange = vi.fn();
    render(
      <TolerationEditor
        tolerations={existingTolerations}
        onChange={onChange}
      />,
    );

    expect(screen.getByDisplayValue('dedicated')).toBeInTheDocument();
    expect(
      screen.getByDisplayValue('elasticsearch'),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue('node.kubernetes.io/not-ready'),
    ).toBeInTheDocument();
  });

  it('renders header labels on the first row only', () => {
    const onChange = vi.fn();
    render(
      <TolerationEditor
        tolerations={existingTolerations}
        onChange={onChange}
      />,
    );

    // The labels "Key", "Operator", "Value", "Effect" appear once each
    // (only on index === 0)
    expect(screen.getByText('Key')).toBeInTheDocument();
    expect(screen.getByText('Operator')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
    expect(screen.getByText('Effect')).toBeInTheDocument();
  });

  it('disables the value field when operator is "Exists"', () => {
    const onChange = vi.fn();
    render(
      <TolerationEditor
        tolerations={existingTolerations}
        onChange={onChange}
      />,
    );

    // The second toleration has operator "Exists"
    const valueInputs = screen.getAllByLabelText('Toleration value');
    // First toleration value should not be disabled
    expect(valueInputs[0]).not.toBeDisabled();
    // Second toleration value should be disabled
    expect(valueInputs[1]).toBeDisabled();
  });

  it('clears value and calls onChange when operator is changed to "Exists"', () => {
    const onChange = vi.fn();
    const tolerations: TolerationIntent[] = [
      {
        key: 'dedicated',
        operator: 'Equal',
        value: 'elasticsearch',
        effect: 'NoSchedule',
      },
    ];
    render(
      <TolerationEditor tolerations={tolerations} onChange={onChange} />,
    );

    const operatorSelect = screen.getByLabelText('Toleration operator');
    fireEvent.change(operatorSelect, { target: { value: 'Exists' } });

    expect(onChange).toHaveBeenCalledWith([
      {
        key: 'dedicated',
        operator: 'Exists',
        value: '',
        effect: 'NoSchedule',
      },
    ]);
  });

  it('adds a new empty toleration when "Add toleration" is clicked', () => {
    const onChange = vi.fn();
    render(
      <TolerationEditor tolerations={[]} onChange={onChange} />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /add toleration/i }),
    );

    expect(onChange).toHaveBeenCalledWith([
      { key: '', operator: 'Equal', value: '', effect: '' },
    ]);
  });

  it('appends to existing tolerations when adding', () => {
    const onChange = vi.fn();
    render(
      <TolerationEditor
        tolerations={existingTolerations}
        onChange={onChange}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /add toleration/i }),
    );

    expect(onChange).toHaveBeenCalledWith([
      ...existingTolerations,
      { key: '', operator: 'Equal', value: '', effect: '' },
    ]);
  });

  it('removes a toleration when the trash button is clicked', () => {
    const onChange = vi.fn();
    render(
      <TolerationEditor
        tolerations={existingTolerations}
        onChange={onChange}
      />,
    );

    // Remove the first toleration
    const removeButton = screen.getByLabelText('Remove toleration 1');
    fireEvent.click(removeButton);

    expect(onChange).toHaveBeenCalledWith([existingTolerations[1]]);
  });

  it('calls onChange with updated key when a toleration key is edited', () => {
    const onChange = vi.fn();
    render(
      <TolerationEditor
        tolerations={existingTolerations}
        onChange={onChange}
      />,
    );

    const keyInput = screen.getByDisplayValue('dedicated');
    fireEvent.change(keyInput, { target: { value: 'workload-type' } });

    expect(onChange).toHaveBeenCalledWith([
      {
        ...existingTolerations[0],
        key: 'workload-type',
      },
      existingTolerations[1],
    ]);
  });

  it('allows changing the effect via the select dropdown', () => {
    const onChange = vi.fn();
    const tolerations: TolerationIntent[] = [
      { key: 'zone', operator: 'Equal', value: 'us-east', effect: 'NoSchedule' },
    ];
    render(
      <TolerationEditor tolerations={tolerations} onChange={onChange} />,
    );

    const effectSelect = screen.getByLabelText('Toleration effect');
    fireEvent.change(effectSelect, {
      target: { value: 'PreferNoSchedule' },
    });

    expect(onChange).toHaveBeenCalledWith([
      {
        key: 'zone',
        operator: 'Equal',
        value: 'us-east',
        effect: 'PreferNoSchedule',
      },
    ]);
  });

  it('hides add and remove controls when readOnly is true', () => {
    const onChange = vi.fn();
    render(
      <TolerationEditor
        tolerations={existingTolerations}
        onChange={onChange}
        readOnly
      />,
    );

    expect(
      screen.queryByRole('button', { name: /add toleration/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/remove toleration/i),
    ).not.toBeInTheDocument();
  });

  it('renders an empty state when no tolerations are provided', () => {
    const onChange = vi.fn();
    render(
      <TolerationEditor tolerations={[]} onChange={onChange} />,
    );

    // Only the "Add toleration" button should be visible
    expect(
      screen.getByRole('button', { name: /add toleration/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Toleration key'),
    ).not.toBeInTheDocument();
  });
});
