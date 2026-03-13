import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUserRole, hasMinRole } from '../useUserRole';
import { useAuthStore } from '../../stores/authStore';
import type { PlatformRole } from '../useUserRole';

function setRole(role: PlatformRole | null) {
  useAuthStore.setState({
    role,
    isAuthenticated: true,
    isLoading: false,
  });
}

afterEach(() => {
  useAuthStore.setState({
    user: null,
    role: null,
    roles: {},
    isAuthenticated: false,
    isLoading: false,
    activeOrg: null,
    orgs: [],
    error: null,
  });
});

describe('useUserRole', () => {
  it('returns platform-admin from store', () => {
    setRole('platform-admin');
    const { result } = renderHook(() => useUserRole());
    expect(result.current).toBe('platform-admin');
  });

  it('returns deployment-manager from store', () => {
    setRole('deployment-manager');
    const { result } = renderHook(() => useUserRole());
    expect(result.current).toBe('deployment-manager');
  });

  it('returns platform-viewer from store', () => {
    setRole('platform-viewer');
    const { result } = renderHook(() => useUserRole());
    expect(result.current).toBe('platform-viewer');
  });

  it('returns deployment-viewer from store', () => {
    setRole('deployment-viewer');
    const { result } = renderHook(() => useUserRole());
    expect(result.current).toBe('deployment-viewer');
  });

  it('defaults to platform-admin when role is null', () => {
    setRole(null);
    const { result } = renderHook(() => useUserRole());
    expect(result.current).toBe('platform-admin');
  });
});

describe('hasMinRole', () => {
  it('platform-admin meets all thresholds', () => {
    expect(hasMinRole('platform-admin', 'platform-admin')).toBe(true);
    expect(hasMinRole('platform-admin', 'deployment-manager')).toBe(true);
    expect(hasMinRole('platform-admin', 'platform-viewer')).toBe(true);
    expect(hasMinRole('platform-admin', 'deployment-viewer')).toBe(true);
  });

  it('deployment-viewer only meets deployment-viewer', () => {
    expect(hasMinRole('deployment-viewer', 'platform-admin')).toBe(false);
    expect(hasMinRole('deployment-viewer', 'deployment-manager')).toBe(false);
    expect(hasMinRole('deployment-viewer', 'platform-viewer')).toBe(false);
    expect(hasMinRole('deployment-viewer', 'deployment-viewer')).toBe(true);
  });

  it('deployment-manager meets manager and below', () => {
    expect(hasMinRole('deployment-manager', 'platform-admin')).toBe(false);
    expect(hasMinRole('deployment-manager', 'deployment-manager')).toBe(true);
    expect(hasMinRole('deployment-manager', 'platform-viewer')).toBe(true);
    expect(hasMinRole('deployment-manager', 'deployment-viewer')).toBe(true);
  });
});
