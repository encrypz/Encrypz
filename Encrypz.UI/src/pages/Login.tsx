import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthLayout } from '../components/AuthLayout';
import './AuthLayout.css';
import { activateVaultKey, createVaultConfig, unlockVaultConfig, lockVault } from '../utils/crypto';
import type { VaultConfig } from '../utils/crypto';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
type Session = {
  userId: string;
  username: string;
  isGoogleDriveConnected: boolean;
  hasMasterPassword: boolean;
  vaultConfig: VaultConfig | null;
  recoveryRequired?: boolean;
};

export const Login: React.FC<{ registering?: boolean }> = ({ registering = false }) => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [backup, setBackup] = useState<VaultConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(() => new URLSearchParams(window.location.search).has('error')
    ? 'Google authorization was cancelled or failed. Please try again.' : '');

  useEffect(() => {
    document.title = registering ? 'Encrypz - Create Vault' : 'Encrypz - Sign In';
    // A Google callback may select another account. Never reuse a previous account's key.
    sessionStorage.clear();
    lockVault();
    let active = true;
    axios.get<Session>(`${API_BASE_URL}/Auth/session`)
      .then(({ data }) => { if (active) setSession(data); })
      .catch((err) => {
        if (active && err.response?.data?.recoveryRequired) {
          setSession({ ...err.response.data, isGoogleDriveConnected: true, hasMasterPassword: false, vaultConfig: null });
        }
        if (active && err.response?.status !== 401) setError(err.response?.data?.message || (typeof err.response?.data === 'string' ? err.response.data : 'Cannot reach Google Drive. Please reload to try again.'));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [registering]);

  const setup = session && !session.hasMasterPassword && !backup && !session.recoveryRequired;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session) return;
    setError('');
    if (setup && password !== confirmation) {
      setError('The master passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const data = session;
      if (backup) {
        const key = await unlockVaultConfig(password, session.userId, backup);
        await axios.post(`${API_BASE_URL}/Auth/vault-config/recover`, backup);
        activateVaultKey(key);
      } else if (session.recoveryRequired) {
        throw new Error('Select your vault configuration backup first.');
      } else if (setup) {
        const { config, key } = await createVaultConfig(password, session.userId);
        await axios.post(`${API_BASE_URL}/Auth/vault-config`, config);
        activateVaultKey(key);
      } else {
        activateVaultKey(await unlockVaultConfig(password, session.userId, session.vaultConfig!));
      }
      sessionStorage.setItem('userId', data.userId);
      sessionStorage.setItem('username', data.username);
      sessionStorage.setItem('isGoogleDriveConnected', String(data.isGoogleDriveConnected));
      setPassword('');
      setConfirmation('');
      navigate(data.isGoogleDriveConnected ? '/vault' : '/connect');
    } catch (err) {
      const response = axios.isAxiosError(err) ? err.response : undefined;
      setError(response?.status === 429 ? 'Too many attempts. Please wait a minute and try again.'
        : typeof response?.data === 'string' ? response.data : response?.data?.message || (err instanceof Error ? err.message : 'Unable to open your vault. Please try again.'));
    } finally { setSubmitting(false); }
  };

  const signOut = async () => {
    try {
      await axios.post(`${API_BASE_URL}/Auth/logout`);
      sessionStorage.clear();
      lockVault();
      setSession(null);
      setBackup(null);
      setPassword('');
      setConfirmation('');
      setError('');
    } catch { setError('Sign-out failed. Please try again.'); }
  };

  return (
    <AuthLayout>
      <div className="auth-login-card">
        <h2 className="auth-login-title">{backup || session?.recoveryRequired ? 'Restore your vault configuration' : setup ? 'Set your master password' : session ? 'Unlock your vault' : registering ? 'Create your vault' : 'Welcome to Encrypz'}</h2>
        <p className="auth-card-sub">
          {session ? `Google account connected: ${session.username}` : 'Connect your Google account, then use one master password to access your encrypted files.'}
        </p>
        {error && <div className="auth-alert-error" role="alert">{error}</div>}
        {loading ? <p role="status">Checking your session...</p> : session ? (
          <form onSubmit={submit}>
            {!session.hasMasterPassword && <div className="auth-form-group">
              <label className="auth-label" htmlFor="config-backup">Restore an existing configuration backup (optional for new vaults)</label>
              <input id="config-backup" type="file" accept=".json" disabled={submitting} onChange={async e => {
                try {
                  const file = e.target.files?.[0];
                  setBackup(file ? JSON.parse(await file.text()) : null);
                  setError('');
                } catch { setBackup(null); setError('Select a valid JSON configuration backup.'); }
              }} />
            </div>}
            <div className="auth-form-group">
              <label className="auth-label" htmlFor="master-password">Master password</label>
              <input id="master-password" className="auth-input" type="password" required minLength={setup ? 12 : 6} maxLength={128}
                autoComplete={setup ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            {setup && <>
              <div className="auth-form-group">
                <label className="auth-label" htmlFor="confirm-password">Confirm master password</label>
                <input id="confirm-password" className="auth-input" type="password" required maxLength={128} autoComplete="new-password"
                  value={confirmation} onChange={e => setConfirmation(e.target.value)} />
              </div>
              <p className="auth-card-sub">Use at least 12 characters. Keep this password safe: it cannot be recovered. If you used an older Encrypz vault, import its metadata backup before uploading new files.</p>
            </>}
            <button className="auth-btn-white-full" type="submit" disabled={submitting}>
              {submitting ? 'Opening vault...' : backup || session.recoveryRequired ? 'Restore & unlock vault' : setup ? 'Set master password & open vault' : 'Unlock vault'}
            </button>
            <p className="auth-card-sub">On another device, sign in with the same Google account and master password to open your files.</p>
          </form>
        ) : (
          <button className="auth-btn-white-full" onClick={() => { window.location.href = `${API_BASE_URL}/Auth/google-login`; }}>
            Continue with Google
          </button>
        )}
        {!loading && <div className="auth-switch-prompt">
          {session ? <button className="auth-btn-secondary" onClick={signOut} disabled={submitting}>Use another account</button>
            : <>
              <p><Link className="auth-link-bold" to={registering ? '/login' : '/register'}>{registering ? 'Already have a vault? Sign in' : 'Create a vault'}</Link></p>
            </>}
        </div>}
      </div>
    </AuthLayout>
  );
};
