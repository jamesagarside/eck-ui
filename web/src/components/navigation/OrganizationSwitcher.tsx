import { useState } from 'react';
import {
  EuiPopover,
  EuiButtonEmpty,
  EuiSelectable,
  type EuiSelectableOption,
} from '@elastic/eui';
import { useAuthStore } from '../../stores/authStore';

export function OrganizationSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const activeOrg = useAuthStore((s) => s.activeOrg);
  const orgs = useAuthStore((s) => s.orgs);
  const switchOrg = useAuthStore((s) => s.switchOrg);

  if (orgs.length <= 1) {
    return null;
  }

  const options: EuiSelectableOption[] = orgs.map((org) => ({
    label: org.name,
    checked: org.name === activeOrg?.name ? 'on' : undefined,
  }));

  const handleChange = (newOptions: EuiSelectableOption[]) => {
    const selected = newOptions.find((opt) => opt.checked === 'on');
    if (selected) {
      switchOrg(selected.label);
      setIsOpen(false);
    }
  };

  return (
    <EuiPopover
      button={
        <EuiButtonEmpty
          iconType="arrowDown"
          iconSide="right"
          onClick={() => setIsOpen(!isOpen)}
          size="s"
          aria-label="Switch organization"
        >
          {activeOrg?.name || 'Select organization'}
        </EuiButtonEmpty>
      }
      isOpen={isOpen}
      closePopover={() => setIsOpen(false)}
      panelPaddingSize="none"
      anchorPosition="downRight"
    >
      <EuiSelectable
        singleSelection
        options={options}
        onChange={handleChange}
        listProps={{ bordered: false }}
        style={{ width: 240 }}
        aria-label="Organization list"
      >
        {(list) => list}
      </EuiSelectable>
    </EuiPopover>
  );
}
