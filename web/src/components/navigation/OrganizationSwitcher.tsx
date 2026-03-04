import { useState } from 'react';
import {
  EuiPopover,
  EuiButtonEmpty,
  EuiListGroup,
  EuiListGroupItem,
  EuiIcon,
  EuiFlexGroup,
  EuiFlexItem,
  EuiText,
  EuiHorizontalRule,
  EuiFieldSearch,
  EuiSpacer,
} from '@elastic/eui';
import { useOrganization } from '../../context/OrganizationContext';

export function OrganizationSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const { organizations, currentOrganization, setCurrentOrganization, isLoading } =
    useOrganization();

  const filteredOrgs = organizations.filter((org) =>
    org.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  const button = (
    <EuiButtonEmpty
      iconType="arrowDown"
      iconSide="right"
      onClick={() => setIsOpen(!isOpen)}
      size="s"
    >
      <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiIcon type="spaces" />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiText size="s">
            <strong>{currentOrganization?.name ?? 'Select Organization'}</strong>
          </EuiText>
        </EuiFlexItem>
      </EuiFlexGroup>
    </EuiButtonEmpty>
  );

  return (
    <EuiPopover
      button={button}
      isOpen={isOpen}
      closePopover={() => setIsOpen(false)}
      anchorPosition="downLeft"
      panelPaddingSize="s"
    >
      <div style={{ width: 280 }}>
        <EuiFieldSearch
          placeholder="Search organizations..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          isClearable
          compressed
        />

        <EuiSpacer size="s" />

        <EuiListGroup flush gutterSize="none" maxWidth={false}>
          {isLoading ? (
            <EuiListGroupItem label="Loading..." isDisabled />
          ) : filteredOrgs.length === 0 ? (
            <EuiListGroupItem label="No organizations found" isDisabled />
          ) : (
            filteredOrgs.map((org) => (
              <EuiListGroupItem
                key={org.id}
                label={
                  <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
                    <EuiFlexItem grow={false}>
                      <EuiIcon
                        type="check"
                        color={currentOrganization?.id === org.id ? 'primary' : 'ghost'}
                      />
                    </EuiFlexItem>
                    <EuiFlexItem>
                      <EuiText size="s">{org.name}</EuiText>
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiText size="xs" color="subdued">
                        {org.role}
                      </EuiText>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                }
                onClick={() => {
                  setCurrentOrganization(org);
                  setIsOpen(false);
                  setSearchValue('');
                }}
                isActive={currentOrganization?.id === org.id}
                size="s"
              />
            ))
          )}
        </EuiListGroup>

        <EuiHorizontalRule margin="s" />

        <EuiListGroupItem
          iconType="plus"
          label="Create organization"
          href="/organizations/new"
          size="s"
        />
      </div>
    </EuiPopover>
  );
}
