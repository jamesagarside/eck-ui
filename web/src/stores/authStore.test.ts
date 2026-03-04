import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';

describe('authStore', () => {
  beforeEach(() => {
    // Reset the store to initial state before each test
    useAuthStore.setState({
      user: null,
      activeOrg: null,
      orgs: [],
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  it('has correct initial state', () => {
    const state = useAuthStore.getState();

    expect(state.user).toBeNull();
    expect(state.activeOrg).toBeNull();
    expect(state.orgs).toEqual([]);
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('logout clears all auth state', async () => {
    // Arrange: set up an authenticated state
    useAuthStore.setState({
      user: { username: 'admin', uid: '1', groups: ['admin'] },
      activeOrg: { name: 'default', namespaces: ['default'] },
      orgs: [{ name: 'default', namespaces: ['default'] }],
      isAuthenticated: true,
      isLoading: false,
      error: 'some old error',
    });

    // Verify pre-condition
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    // Act: logout (the API call will fail since no server is running,
    // but logout always clears local state regardless)
    await useAuthStore.getState().logout();

    // Assert: all state is cleared
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.activeOrg).toBeNull();
    expect(state.orgs).toEqual([]);
    expect(state.isAuthenticated).toBe(false);
    expect(state.error).toBeNull();
  });

  it('switchOrg updates activeOrg when org exists', () => {
    // Arrange: set up state with multiple orgs
    const orgs = [
      { name: 'default', namespaces: ['default'] },
      { name: 'production', namespaces: ['prod-ns'] },
      { name: 'staging', namespaces: ['staging-ns'] },
    ];
    useAuthStore.setState({
      user: { username: 'admin', uid: '1', groups: ['admin'] },
      activeOrg: orgs[0],
      orgs,
      isAuthenticated: true,
    });

    // Act: switch to production
    useAuthStore.getState().switchOrg('production');

    // Assert
    expect(useAuthStore.getState().activeOrg).toEqual({
      name: 'production',
      namespaces: ['prod-ns'],
    });
  });

  it('switchOrg does not change activeOrg when org does not exist', () => {
    // Arrange
    const orgs = [{ name: 'default', namespaces: ['default'] }];
    useAuthStore.setState({
      activeOrg: orgs[0],
      orgs,
      isAuthenticated: true,
    });

    // Act: attempt to switch to a non-existent org
    useAuthStore.getState().switchOrg('nonexistent');

    // Assert: activeOrg is unchanged
    expect(useAuthStore.getState().activeOrg).toEqual({
      name: 'default',
      namespaces: ['default'],
    });
  });
});
