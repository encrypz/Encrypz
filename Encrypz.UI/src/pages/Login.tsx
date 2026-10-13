import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { AuthLayout } from '../components/AuthLayout';
import './AuthLayout.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

type Session = {
  userId: string;
  username: string;
  isGoogleDriveConnected: boolean;
};

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [masterPassword, setMasterPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);

  useEffect(() => {
    document.title = 'Encrypz - Sign In';
    const isGoogleSuccess = new URLSearchParams(window.location.search).get('google') === 'success';
    const existingMaster = sessionStorage.getItem('masterPassword');

    if (!isGoogleSuccess && !existingMaster) {
      sessionStorage.clear();
    }

    axios
      .get<Session>(`${API_BASE_URL}/Auth/session`)
      .then(({ data }) => {
        setSession(data);
        sessionStorage.setItem('userId', data.userId);
        sessionStorage.setItem('username', data.username);
        sessionStorage.setItem('isGoogleDriveConnected', String(data.isGoogleDriveConnected));

        if (existingMaster && data.isGoogleDriveConnected) {
          navigate('/vault');
        }
      })
      .catch((err) => {
        if (err.response?.status !== 401) {
          setError('Cannot reach the sign-in service. Please try again.');
        }
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const { data } = await axios.post<Session>(`${API_BASE_URL}/Auth/login`, {
        username: username.trim(),
        password,
      });

      sessionStorage.setItem('userId', data.userId);
      sessionStorage.setItem('username', data.username);
      sessionStorage.setItem('masterPassword', password);
      sessionStorage.setItem('isGoogleDriveConnected', String(data.isGoogleDriveConnected));
      if (keepLoggedIn) {
        localStorage.setItem('encrypz_remember_username', data.username);
      }

      setPassword('');
      navigate(data.isGoogleDriveConnected ? '/vault' : '/connect');
    } catch (err) {
      const response = axios.isAxiosError(err) ? err.response : undefined;
      if (response?.status === 429) {
        setError('Too many attempts. Please wait a minute and try again.');
      } else if (response?.status === 401) {
        setError('Invalid username or password.');
      } else if (typeof response?.data === 'string') {
        setError(response.data);
      } else {
        setError('Unable to sign in. Please check your credentials.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const unlockVault = (event: React.FormEvent) => {
    event.preventDefault();
    if (!session || !masterPassword) return;

    sessionStorage.setItem('userId', session.userId);
    sessionStorage.setItem('username', session.username);
    sessionStorage.setItem('masterPassword', masterPassword);
    sessionStorage.setItem('isGoogleDriveConnected', String(session.isGoogleDriveConnected));

    navigate(session.isGoogleDriveConnected ? '/vault' : '/connect');
  };

  const handleSignOut = async () => {
    try {
      await axios.post(`${API_BASE_URL}/Auth/logout`);
      sessionStorage.clear();
      setSession(null);
      setMasterPassword('');
    } catch {
      setError('Sign-out failed. Please try again.');
    }
  };

  return (
    <AuthLayout>
      {/* Main Login Card */}
      <div className="auth-login-card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#9da3af' }}>
            Checking your session...
          </div>
        ) : session ? (
          /* Vault Unlock View if already logged in */
          <div>
            <h2 className="auth-login-title">Unlock your Encrypz vault</h2>
            <p style={{ color: '#9da3af', fontSize: '0.9rem', marginBottom: '20px' }}>
              Signed in as <strong style={{ color: '#ffffff' }}>{session.username}</strong>
            </p>

            {error && <div className="auth-alert-error" role="alert">{error}</div>}

            <form onSubmit={unlockVault}>
              <div className="auth-form-group">
                <label className="auth-label" htmlFor="vault-master-password">
                  Master password
                </label>
                <input
                  id="vault-master-password"
                  className="auth-input"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="Enter vault master password"
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                />
              </div>

              <p style={{ color: '#858b99', fontSize: '0.8rem', lineHeight: '1.45', margin: '14px 0 20px 0' }}>
                Your master password stays in this browser tab and encrypts your files with AES-GCM. 
                Encrypz cannot recover it. A different password cannot decrypt existing files.
              </p>

              <button type="submit" className="auth-btn-white-full" style={{ marginBottom: '12px' }}>
                Unlock vault
              </button>

              <button
                type="button"
                className="auth-btn-secondary"
                style={{ marginTop: '0', justifyContent: 'center' }}
                onClick={handleSignOut}
              >
                Sign out
              </button>
            </form>
          </div>
        ) : (
          /* Standard Login Form */
          <div>
            <h2 className="auth-login-title">Log in to your Encrypz account</h2>

            {error && <div className="auth-alert-error" role="alert">{error}</div>}

            <form onSubmit={handleLogin}>
              <div className="auth-form-group">
                <label className="auth-label" htmlFor="login-username">
                  Username or email address
                </label>
                <input
                  id="login-username"
                  className="auth-input"
                  type="text"
                  autoComplete="username"
                  required
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="auth-form-group" style={{ marginBottom: '10px' }}>
                <label className="auth-label" htmlFor="login-password">
                  Password
                </label>
                <input
                  id="login-password"
                  className="auth-input"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="auth-forgot-row">
                <a
                  href="#forgot"
                  className="auth-forgot-link"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowForgotModal(true);
                  }}
                >
                  Forgot password?
                </a>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    id="keep-logged-in"
                    type="checkbox"
                    className="auth-checkbox"
                    checked={keepLoggedIn}
                    onChange={(e) => setKeepLoggedIn(e.target.checked)}
                  />
                  <label htmlFor="keep-logged-in" className="auth-checkbox-label">
                    Keep me logged in
                  </label>
                </div>
                <div className="auth-checkbox-sub">Use this for devices you trust</div>
              </div>

              <button
                type="submit"
                className="auth-btn-white-full"
                disabled={submitting}
              >
                {submitting ? 'Logging in...' : 'Log in'}
              </button>
            </form>

            <div className="auth-switch-prompt">
              Don't have an account?{' '}
              <Link to="/register" className="auth-link-bold">
                Sign up
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Security Tip Box below main login card */}
      <div className="auth-security-tip-box">
        <div className="auth-tip-header">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="9" y1="18" x2="15" y2="18"></line>
            <line x1="10" y1="22" x2="14" y2="22"></line>
            <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"></path>
          </svg>
          <span>Security tip</span>
        </div>
        <p className="auth-tip-desc">
          Keep your account safe by only signing in on devices you know and trust. For
          best security, avoid logging in from shared or public computers.
        </p>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="auth-modal-overlay" onClick={() => setShowForgotModal(false)}>
          <div className="auth-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="auth-modal-header">
              <h3 className="auth-modal-title">Password Recovery Notice</h3>
              <button className="auth-modal-close" onClick={() => setShowForgotModal(false)}>
                &times;
              </button>
            </div>
            <div className="auth-modal-body">
              <p>
                <strong>Zero-Knowledge Architecture:</strong>
              </p>
              <p>
                Because Encrypz utilizes zero-knowledge client-side encryption, your account password and vault key 
                are cryptographically protected and never known to Encrypz servers.
              </p>
              <p>
                If you have forgotten your password, you will need to create a new vault profile or contact your administrator.
              </p>
            </div>
          </div>
        </div>
      )}
    </AuthLayout>
  );
};
