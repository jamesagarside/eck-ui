import type { PlatformRole } from '../hooks/useUserRole';

export interface RoleBindingSubject {
  kind: 'User' | 'Group';
  name: string;
}

export interface ECKUIRoleBindingSpec {
  role: PlatformRole;
  eckInstance?: string;
  subjects: RoleBindingSubject[];
}

export interface ECKUIRoleBinding {
  apiVersion?: string;
  kind?: string;
  metadata: {
    name: string;
    creationTimestamp?: string;
    uid?: string;
  };
  spec: ECKUIRoleBindingSpec;
}

export interface CreateRoleBindingRequest {
  metadata: {
    name: string;
  };
  spec: ECKUIRoleBindingSpec;
}
