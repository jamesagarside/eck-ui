import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  EuiPageTemplate,
  EuiHeader,
  EuiHeaderSectionItem,
  EuiHeaderLogo,
  EuiHeaderLinks,
  EuiHeaderLink,
  EuiAvatar,
  EuiPopover,
  EuiFlexGroup,
  EuiFlexItem,
  EuiText,
  EuiSpacer,
  EuiButtonEmpty,
  EuiHorizontalRule,
} from '@elastic/eui';
import { EuiBadge } from '@elastic/eui';
import { Sidebar } from '../navigation/Sidebar';
import { OrganizationSwitcher } from '../navigation/OrganizationSwitcher';
import { useAuthStore } from '../../stores/authStore';
import { useUserRole } from '../../hooks/useUserRole';
import type { PlatformRole } from '../../hooks/useUserRole';
import { useUserPreferences } from '../../context/UserPreferencesContext';

const ROLE_DISPLAY: Record<PlatformRole, { label: string; color: 'primary' | 'success' | 'default' | 'hollow' }> = {
  'platform-admin': { label: 'Admin', color: 'primary' },
  'deployment-manager': { label: 'Manager', color: 'success' },
  'platform-viewer': { label: 'Viewer', color: 'default' },
  'deployment-viewer': { label: 'Viewer', color: 'hollow' },
};

function buildBreadcrumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs = [{ text: 'ECK UI', href: '/' }];

  const labelMap: Record<string, string> = {
    elasticsearch: 'Elasticsearch',
    kibana: 'Kibana',
    apm: 'APM Server',
    beats: 'Beats',
    agent: 'Elastic Agent',
    logstash: 'Logstash',
    'enterprise-search': 'Enterprise Search',
    maps: 'Elastic Maps',
    wizard: 'Stack Wizard',
    create: 'Create',
    edit: 'Edit',
  };

  let path = '';
  for (const segment of segments) {
    path += `/${segment}`;
    crumbs.push({
      text: labelMap[segment] || decodeURIComponent(segment),
      href: path,
    });
  }

  return crumbs;
}

export function AppShell() {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const role = useUserRole();
  const { colorMode, setColorMode } = useUserPreferences();
  const roleDisplay = ROLE_DISPLAY[role];

  const breadcrumbs = buildBreadcrumbs(location.pathname).map((crumb) => ({
    ...crumb,
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      if (crumb.href) {
        navigate(crumb.href);
      }
    },
  }));

  const handleLogout = async () => {
    setIsUserMenuOpen(false);
    await logout();
    navigate('/');
  };

  const toggleTheme = () => {
    setColorMode(colorMode === 'light' ? 'dark' : 'light');
  };

  const userMenuButton = (
    <EuiHeaderSectionItem>
      <button
        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
        aria-label="User menu"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <EuiAvatar
          name={user?.username || 'User'}
          size="s"
        />
        <EuiBadge color={roleDisplay.color}>{roleDisplay.label}</EuiBadge>
      </button>
    </EuiHeaderSectionItem>
  );

  return (
    <div className="eck-app-shell">
      <EuiHeader
        position="fixed"
        sections={[
          {
            items: [
              <EuiHeaderLogo
                key="logo"
                iconType="logoElastic"
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  navigate('/');
                }}
                href="/"
                aria-label="Go to home page"
              >
                ECK UI
              </EuiHeaderLogo>,
            ],
            breadcrumbs,
            breadcrumbProps: { max: 4 },
          },
          {
            items: [
              <EuiHeaderLinks key="links" aria-label="App navigation links">
                <OrganizationSwitcher />
                <EuiHeaderLink
                  iconType={colorMode === 'light' ? 'moon' : 'sun'}
                  onClick={toggleTheme}
                  aria-label={`Switch to ${colorMode === 'light' ? 'dark' : 'light'} mode`}
                />
              </EuiHeaderLinks>,
              <EuiPopover
                key="user-menu"
                button={userMenuButton}
                isOpen={isUserMenuOpen}
                closePopover={() => setIsUserMenuOpen(false)}
                anchorPosition="downRight"
                panelPaddingSize="m"
              >
                <div style={{ width: 240 }}>
                  <EuiFlexGroup
                    gutterSize="s"
                    alignItems="center"
                    responsive={false}
                  >
                    <EuiFlexItem grow={false}>
                      <EuiAvatar
                        name={user?.username || 'User'}
                        size="m"
                      />
                    </EuiFlexItem>
                    <EuiFlexItem>
                      <EuiText size="s">
                        <strong>{user?.username || 'Anonymous'}</strong>
                      </EuiText>
                      <EuiText size="xs" color="subdued">
                        {role}
                      </EuiText>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                  <EuiHorizontalRule margin="s" />
                  <EuiSpacer size="xs" />
                  <EuiButtonEmpty
                    iconType={colorMode === 'light' ? 'moon' : 'sun'}
                    onClick={toggleTheme}
                    size="s"
                    flush="left"
                  >
                    {colorMode === 'light' ? 'Dark' : 'Light'} mode
                  </EuiButtonEmpty>
                  <EuiSpacer size="xs" />
                  <EuiButtonEmpty
                    iconType="exit"
                    onClick={handleLogout}
                    size="s"
                    flush="left"
                    color="danger"
                  >
                    Log out
                  </EuiButtonEmpty>
                </div>
              </EuiPopover>,
            ],
          },
        ]}
      />
      <EuiPageTemplate
        paddingSize="l"
        grow
        style={{ minHeight: 'calc(100vh - 48px)', paddingTop: '48px' }}
      >
        <EuiPageTemplate.Sidebar sticky>
          <Sidebar />
        </EuiPageTemplate.Sidebar>
        <EuiPageTemplate.Section grow>
          <Outlet />
        </EuiPageTemplate.Section>
      </EuiPageTemplate>
    </div>
  );
}
