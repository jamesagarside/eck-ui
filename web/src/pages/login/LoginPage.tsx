import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EuiButton,
  EuiCallOut,
  EuiEmptyPrompt,
  EuiFieldText,
  EuiForm,
  EuiFormRow,
  EuiIcon,
  EuiPanel,
  EuiSpacer,
  EuiText,
} from '@elastic/eui';
import { useAuthStore } from '../../stores/authStore';

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const storeError = useAuthStore((s) => s.error);

  const [token, setToken] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const error = localError ?? storeError;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!token.trim()) {
      setLocalError('Token is required');
      return;
    }

    await login(token);

    const isAuthenticated = useAuthStore.getState().isAuthenticated;
    if (isAuthenticated) {
      navigate('/');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '24px',
      }}
    >
      <EuiPanel
        paddingSize="l"
        style={{ maxWidth: 440, width: '100%' }}
      >
        <EuiEmptyPrompt
          icon={<EuiIcon type="logoElastic" size="xxl" />}
          title={<h2>ECK UI</h2>}
          body={
            <EuiText size="s" color="subdued">
              <p>Enter your service account token to sign in.</p>
            </EuiText>
          }
        />

        <EuiSpacer size="l" />

        {error && (
          <>
            <EuiCallOut
              title={error}
              color="danger"
              iconType="error"
              size="s"
              role="alert"
            />
            <EuiSpacer size="m" />
          </>
        )}

        <EuiForm component="form" onSubmit={handleSubmit}>
          <EuiFormRow
            label="Token"
            fullWidth
          >
            <EuiFieldText
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter service account token"
              fullWidth
              autoFocus
              aria-label="Service account token"
            />
          </EuiFormRow>

          <EuiSpacer size="l" />

          <EuiButton
            type="submit"
            fill
            fullWidth
            isLoading={isLoading}
          >
            Sign in
          </EuiButton>
        </EuiForm>
      </EuiPanel>
    </div>
  );
}
