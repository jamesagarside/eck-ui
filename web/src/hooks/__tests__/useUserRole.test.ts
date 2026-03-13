import { renderHook, act } from '@testing-library/react';
import { useUserRole } from '../useUserRole';
import { useAuthStore } from '../../stores/authStore';

function setUser(groups: string[]) {
  useAuthStore.setState({
    user: { username: 'test', uid: '1', groups },
    isAuthenticated: true,
  });
}

function clearUser() {
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
  });
}

describe('useUserRole', () => {
  afterEach(() => clearUser());

  it('returns admin when user has admin group', () => {
    setUser(['admin']);
    const { result } = renderHook(() => useUserRole());
    expect(result.current).toBe('admin');
  });

  it('returns admin when user has system:serviceaccounts group', () => {
    setUser(['system:serviceaccounts']);
    const { result } = renderHook(() => useUserRole());
    expect(result.current).toBe('admin');
  });

  it('returns admin when user has empty groups array', () => {
    setUser([]);
    const { result } = renderHook(() => useUserRole());
    expect(result.current).toBe('admin');
  });

  it('returns admin when user is null', () => {
    clearUser();
    const { result } = renderHook(() => useUserRole());
    expect(result.current).toBe('admin');
  });

  it('returns editor when user has editor group', () => {
    setUser(['editor']);
    const { result } = renderHook(() => useUserRole());
    expect(result.current).toBe('editor');
  });

  it('returns viewer as default for non-admin non-editor groups', () => {
    setUser(['developers']);
    const { result } = renderHook(() => useUserRole());
    expect(result.current).toBe('viewer');
  });

  it('returns admin when user has both editor and admin groups', () => {
    setUser(['editor', 'admin']);
    const { result } = renderHook(() => useUserRole());
    expect(result.current).toBe('admin');
  });

  it('updates role when store state changes', () => {
    setUser(['developers']);
    const { result } = renderHook(() => useUserRole());
    expect(result.current).toBe('viewer');

    act(() => {
      setUser(['admin']);
    });
    expect(result.current).toBe('admin');
  });
});
