import { useState, useCallback } from 'react';
import {
  EuiPageHeader,
  EuiSpacer,
  EuiBasicTable,
  EuiBadge,
  EuiButton,
  EuiButtonEmpty,
  EuiButtonIcon,
  EuiFlexGroup,
  EuiFlexItem,
  EuiStat,
  EuiPanel,
  EuiFlyout,
  EuiFlyoutHeader,
  EuiFlyoutBody,
  EuiFlyoutFooter,
  EuiTitle,
  EuiFormRow,
  EuiFieldText,
  EuiSuperSelect,
  EuiConfirmModal,
  EuiEmptyPrompt,
  EuiCallOut,
  EuiLoadingSpinner,
  type EuiBasicTableColumn,
  type EuiSuperSelectOption,
} from '@elastic/eui';
import { useRoleBindings, useCreateRoleBinding, useDeleteRoleBinding } from '../../hooks/useRoleBindings';
import { useAuthStore } from '../../stores/authStore';
import type { ECKUIRoleBinding, RoleBindingSubject } from '../../types/rbac';
import type { PlatformRole } from '../../hooks/useUserRole';

const ROLE_OPTIONS: EuiSuperSelectOption<PlatformRole>[] = [
  {
    value: 'platform-admin',
    inputDisplay: 'Platform Admin',
    dropdownDisplay: 'Platform Admin — Full access to all resources and administration',
  },
  {
    value: 'deployment-manager',
    inputDisplay: 'Deployment Manager',
    dropdownDisplay: 'Deployment Manager — Create, edit, and delete resources',
  },
  {
    value: 'platform-viewer',
    inputDisplay: 'Platform Viewer',
    dropdownDisplay: 'Platform Viewer — View all resources across namespaces',
  },
  {
    value: 'deployment-viewer',
    inputDisplay: 'Deployment Viewer',
    dropdownDisplay: 'Deployment Viewer — View assigned deployments only',
  },
];

const ROLE_COLORS: Record<PlatformRole, string> = {
  'platform-admin': 'primary',
  'deployment-manager': 'success',
  'platform-viewer': 'default',
  'deployment-viewer': 'hollow',
};

const ROLE_LABELS: Record<PlatformRole, string> = {
  'platform-admin': 'Platform Admin',
  'deployment-manager': 'Deployment Manager',
  'platform-viewer': 'Platform Viewer',
  'deployment-viewer': 'Deployment Viewer',
};

export function RoleManagementPage() {
  const { data: bindings, isLoading, error } = useRoleBindings();
  const createMutation = useCreateRoleBinding();
  const deleteMutation = useDeleteRoleBinding();
  const user = useAuthStore((s) => s.user);

  const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ECKUIRoleBinding | null>(null);

  // Create form state
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState<PlatformRole>('deployment-viewer');
  const [formSubjects, setFormSubjects] = useState<RoleBindingSubject[]>([
    { kind: 'User', name: '' },
  ]);

  const resetForm = useCallback(() => {
    setFormName('');
    setFormRole('deployment-viewer');
    setFormSubjects([{ kind: 'User', name: '' }]);
  }, []);

  const handleCreate = () => {
    createMutation.mutate(
      {
        metadata: { name: formName },
        spec: {
          role: formRole,
          subjects: formSubjects.filter((s) => s.name.trim() !== ''),
        },
      },
      {
        onSuccess: () => {
          setIsFlyoutOpen(false);
          resetForm();
        },
      },
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.metadata.name, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  const addSubject = () => {
    setFormSubjects([...formSubjects, { kind: 'User', name: '' }]);
  };

  const removeSubject = (index: number) => {
    setFormSubjects(formSubjects.filter((_, i) => i !== index));
  };

  const updateSubject = (index: number, field: keyof RoleBindingSubject, value: string) => {
    const updated = [...formSubjects];
    updated[index] = { ...updated[index], [field]: value };
    setFormSubjects(updated);
  };

  const columns: EuiBasicTableColumn<ECKUIRoleBinding>[] = [
    {
      field: 'metadata.name',
      name: 'Name',
      sortable: true,
    },
    {
      field: 'spec.role',
      name: 'Role',
      render: (role: PlatformRole) => (
        <EuiBadge color={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</EuiBadge>
      ),
      sortable: true,
    },
    {
      field: 'spec.subjects',
      name: 'Subjects',
      render: (subjects: RoleBindingSubject[]) => (
        <EuiFlexGroup gutterSize="xs" wrap responsive={false}>
          {subjects.map((s, i) => (
            <EuiFlexItem grow={false} key={i}>
              <EuiBadge color={s.kind === 'User' ? 'hollow' : 'default'}>
                {s.kind}: {s.name}
              </EuiBadge>
            </EuiFlexItem>
          ))}
        </EuiFlexGroup>
      ),
    },
    {
      field: 'spec.eckInstance',
      name: 'ECK Instance',
      render: (instance: string) => instance || 'local',
    },
    {
      field: 'metadata.creationTimestamp',
      name: 'Created',
      render: (ts: string) => (ts ? new Date(ts).toLocaleDateString() : '—'),
      sortable: true,
    },
    {
      name: 'Actions',
      width: '80px',
      actions: [
        {
          name: 'Delete',
          description: 'Delete this role binding',
          icon: 'trash',
          type: 'icon',
          color: 'danger',
          onClick: (binding: ECKUIRoleBinding) => setDeleteTarget(binding),
        },
      ],
    },
  ];

  // Stats
  const totalBindings = bindings?.length ?? 0;
  const roleCounts = (bindings ?? []).reduce(
    (acc, b) => {
      acc[b.spec.role] = (acc[b.spec.role] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const isFormValid =
    formName.trim() !== '' && formSubjects.some((s) => s.name.trim() !== '');

  return (
    <>
      <EuiPageHeader
        pageTitle="Role Bindings"
        description="Manage ECKUIRoleBinding resources that assign platform roles to users and groups."
        rightSideItems={[
          <EuiButton
            key="create"
            fill
            iconType="plusInCircle"
            onClick={() => setIsFlyoutOpen(true)}
          >
            Create Role Binding
          </EuiButton>,
        ]}
      />

      <EuiSpacer size="l" />

      <EuiFlexGroup>
        <EuiFlexItem>
          <EuiPanel>
            <EuiStat title={totalBindings} description="Total Bindings" titleSize="m" />
          </EuiPanel>
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiPanel>
            <EuiStat
              title={roleCounts['platform-admin'] || 0}
              description="Platform Admins"
              titleSize="m"
              titleColor="primary"
            />
          </EuiPanel>
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiPanel>
            <EuiStat
              title={roleCounts['deployment-manager'] || 0}
              description="Deployment Managers"
              titleSize="m"
              titleColor="success"
            />
          </EuiPanel>
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiPanel>
            <EuiStat
              title={(roleCounts['platform-viewer'] || 0) + (roleCounts['deployment-viewer'] || 0)}
              description="Viewers"
              titleSize="m"
            />
          </EuiPanel>
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiSpacer size="l" />

      <EuiCallOut
        title="Identity source: Kubernetes TokenReview"
        iconType="iInCircle"
        color="primary"
      >
        <p>
          Role bindings match against the <strong>username</strong> and <strong>groups</strong> returned
          by your Kubernetes cluster's authentication backend. When a user logs in, their bearer token
          is validated via the K8s TokenReview API, which returns their identity.
        </p>
        {user && (
          <>
            <EuiSpacer size="s" />
            <p>
              <strong>Your identity:</strong>{' '}
              <EuiBadge color="hollow">User: {user.username}</EuiBadge>
              {user.groups
                .filter((g) => !g.startsWith('system:'))
                .map((g) => (
                  <EuiBadge key={g} style={{ marginLeft: 4 }}>Group: {g}</EuiBadge>
                ))}
            </p>
          </>
        )}
        <EuiSpacer size="s" />
        <p>
          If your cluster uses an OIDC provider (Keycloak, Dex, Azure AD, etc.), usernames and groups
          come from SSO claims. For ServiceAccount tokens, the username is{' '}
          <code>system:serviceaccount:&lt;namespace&gt;:&lt;name&gt;</code>.
          Without any role bindings, roles are inferred from Kubernetes RBAC permissions via SSAR probes.
        </p>
      </EuiCallOut>

      <EuiSpacer size="l" />

      {error && (
        <>
          <EuiCallOut title="Failed to load role bindings" color="danger" iconType="warning">
            <p>{error instanceof Error ? error.message : 'Unknown error'}</p>
          </EuiCallOut>
          <EuiSpacer />
        </>
      )}

      {isLoading ? (
        <EuiFlexGroup justifyContent="center">
          <EuiFlexItem grow={false}>
            <EuiLoadingSpinner size="xl" />
          </EuiFlexItem>
        </EuiFlexGroup>
      ) : totalBindings === 0 && !error ? (
        <EuiEmptyPrompt
          iconType="users"
          title={<h2>No role bindings</h2>}
          body={
            <p>
              Create ECKUIRoleBinding resources to assign platform roles to users and groups.
              Without bindings, roles are inferred from Kubernetes RBAC permissions.
            </p>
          }
          actions={
            <EuiButton fill iconType="plusInCircle" onClick={() => setIsFlyoutOpen(true)}>
              Create Role Binding
            </EuiButton>
          }
        />
      ) : (
        <EuiBasicTable
          items={bindings ?? []}
          columns={columns}
          rowHeader="metadata.name"
        />
      )}

      {/* Create flyout */}
      {isFlyoutOpen && (
        <EuiFlyout onClose={() => setIsFlyoutOpen(false)} size="s">
          <EuiFlyoutHeader hasBorder>
            <EuiTitle size="m">
              <h2>Create Role Binding</h2>
            </EuiTitle>
          </EuiFlyoutHeader>
          <EuiFlyoutBody>
            {createMutation.isError && (
              <>
                <EuiCallOut title="Failed to create" color="danger" iconType="warning">
                  <p>
                    {createMutation.error instanceof Error
                      ? createMutation.error.message
                      : 'Unknown error'}
                  </p>
                </EuiCallOut>
                <EuiSpacer />
              </>
            )}

            <EuiFormRow label="Name" helpText="Unique name for this role binding (kebab-case)">
              <EuiFieldText
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. team-platform-admins"
              />
            </EuiFormRow>

            <EuiSpacer />

            <EuiFormRow label="Role">
              <EuiSuperSelect
                options={ROLE_OPTIONS}
                valueOfSelected={formRole}
                onChange={(value) => setFormRole(value)}
              />
            </EuiFormRow>

            <EuiSpacer />

            <EuiFormRow
              label="Subjects"
              helpText="Usernames and groups as returned by Kubernetes TokenReview (from your OIDC provider, LDAP, or ServiceAccount identity)"
            >
              <div>
                {formSubjects.map((subject, i) => (
                  <EuiFlexGroup key={i} gutterSize="s" alignItems="center" responsive={false}>
                    <EuiFlexItem grow={false} style={{ width: 100 }}>
                      <EuiSuperSelect
                        options={[
                          { value: 'User', inputDisplay: 'User' },
                          { value: 'Group', inputDisplay: 'Group' },
                        ]}
                        valueOfSelected={subject.kind}
                        onChange={(value) => updateSubject(i, 'kind', value)}
                        compressed
                      />
                    </EuiFlexItem>
                    <EuiFlexItem>
                      <EuiFieldText
                        value={subject.name}
                        onChange={(e) => updateSubject(i, 'name', e.target.value)}
                        placeholder={subject.kind === 'User' ? 'username' : 'group-name'}
                        compressed
                      />
                    </EuiFlexItem>
                    {formSubjects.length > 1 && (
                      <EuiFlexItem grow={false}>
                        <EuiButtonIcon
                          iconType="trash"
                          color="danger"
                          aria-label="Remove subject"
                          onClick={() => removeSubject(i)}
                        />
                      </EuiFlexItem>
                    )}
                  </EuiFlexGroup>
                ))}
                <EuiSpacer size="s" />
                <EuiButtonEmpty
                  size="xs"
                  iconType="plusInCircle"
                  onClick={addSubject}
                >
                  Add subject
                </EuiButtonEmpty>
              </div>
            </EuiFormRow>
          </EuiFlyoutBody>
          <EuiFlyoutFooter>
            <EuiFlexGroup justifyContent="spaceBetween">
              <EuiFlexItem grow={false}>
                <EuiButtonEmpty onClick={() => setIsFlyoutOpen(false)}>Cancel</EuiButtonEmpty>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiButton
                  fill
                  onClick={handleCreate}
                  isLoading={createMutation.isPending}
                  disabled={!isFormValid}
                >
                  Create
                </EuiButton>
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiFlyoutFooter>
        </EuiFlyout>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <EuiConfirmModal
          title="Delete role binding"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          cancelButtonText="Cancel"
          confirmButtonText="Delete"
          buttonColor="danger"
          isLoading={deleteMutation.isPending}
        >
          <p>
            Are you sure you want to delete <strong>{deleteTarget.metadata.name}</strong>?
            This will remove the <EuiBadge color={ROLE_COLORS[deleteTarget.spec.role]}>
              {ROLE_LABELS[deleteTarget.spec.role]}
            </EuiBadge> role assignment for{' '}
            {deleteTarget.spec.subjects.length} subject
            {deleteTarget.spec.subjects.length !== 1 ? 's' : ''}.
          </p>
        </EuiConfirmModal>
      )}
    </>
  );
}
