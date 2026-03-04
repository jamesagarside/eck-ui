import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  EuiPageTemplate,
  EuiCollapsibleNav,
  EuiHeader,
  EuiHeaderSection,
  EuiHeaderSectionItem,
  EuiHeaderLogo,
  EuiHeaderLinks,
  EuiHeaderLink,
  EuiButtonIcon,
  EuiToolTip,
  EuiBreadcrumbs,
} from '@elastic/eui';
import type { EuiBreadcrumb } from '@elastic/eui';
import { useTheme } from '../../context/AppProvider';
import { Sidebar } from '../navigation/Sidebar';
import { OrganizationSwitcher } from '../navigation/OrganizationSwitcher';

interface AppShellProps {
  children: ReactNode;
  breadcrumbs?: EuiBreadcrumb[];
}

export function AppShell({ children, breadcrumbs = [] }: AppShellProps) {
  const [navIsOpen, setNavIsOpen] = useState(true);
  const { colorMode, toggleColorMode } = useTheme();

  const defaultBreadcrumbs: EuiBreadcrumb[] = [{ text: 'ECK', href: '/' }, ...breadcrumbs];

  return (
    <>
      {/* Header */}
      <EuiHeader position="fixed">
        <EuiHeaderSection grow={false}>
          <EuiHeaderSectionItem>
            <EuiButtonIcon
              iconType={navIsOpen ? 'menuLeft' : 'menuRight'}
              aria-label="Toggle navigation"
              onClick={() => setNavIsOpen(!navIsOpen)}
              color="text"
            />
          </EuiHeaderSectionItem>
          <EuiHeaderSectionItem>
            <EuiHeaderLogo iconType="logoElastic" href="/">
              ECK UI
            </EuiHeaderLogo>
          </EuiHeaderSectionItem>
        </EuiHeaderSection>

        <EuiHeaderSection>
          <EuiHeaderSectionItem>
            <OrganizationSwitcher />
          </EuiHeaderSectionItem>
        </EuiHeaderSection>

        <EuiHeaderSection side="right">
          <EuiHeaderLinks>
            <EuiToolTip content={colorMode === 'light' ? 'Dark mode' : 'Light mode'}>
              <EuiButtonIcon
                iconType={colorMode === 'light' ? 'moon' : 'sun'}
                aria-label="Toggle dark mode"
                onClick={toggleColorMode}
                color="text"
              />
            </EuiToolTip>
            <EuiHeaderLink iconType="help" href="/docs">
              Help
            </EuiHeaderLink>
            <EuiHeaderLink iconType="user" href="/profile">
              Profile
            </EuiHeaderLink>
          </EuiHeaderLinks>
        </EuiHeaderSection>
      </EuiHeader>

      {/* Collapsible Sidebar Navigation */}
      <EuiCollapsibleNav
        isOpen={navIsOpen}
        isDocked={true}
        size={navIsOpen ? 240 : 48}
        button={<></>}
        onClose={() => setNavIsOpen(false)}
        style={{ top: 48 }} // Below header
      >
        <Sidebar collapsed={!navIsOpen} />
      </EuiCollapsibleNav>

      {/* Main Content */}
      <EuiPageTemplate
        paddingSize="l"
        style={{
          marginTop: 48, // Header height
          marginLeft: navIsOpen ? 240 : 48,
          minHeight: 'calc(100vh - 48px)',
          transition: 'margin-left 250ms ease-in-out',
        }}
      >
        {/* Breadcrumbs */}
        <EuiPageTemplate.Section grow={false} paddingSize="s">
          <EuiBreadcrumbs breadcrumbs={defaultBreadcrumbs} truncate={false} max={6} />
        </EuiPageTemplate.Section>

        {/* Page Content */}
        <EuiPageTemplate.Section>{children}</EuiPageTemplate.Section>
      </EuiPageTemplate>
    </>
  );
}
