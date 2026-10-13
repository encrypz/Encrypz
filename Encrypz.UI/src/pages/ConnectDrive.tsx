import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { AuthLayout } from '../components/AuthLayout';
import './AuthLayout.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface GoogleAccountItem {
  id: string;
  email?: string;
  displayName?: string;
  connectedAt?: string;
}

export const ConnectDrive: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const userId = sessionStorage.getItem('userId');
  const [accounts, setAccounts] = useState<GoogleAccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    document.title = 'Encrypz - Connect Google Drive';

    const params = new URLSearchParams(location.search);
    if (params.get('google') === 'success') {
      setSuccessMsg('Google Drive connected successfully!');
    }
    const err = params.get('error');
    if (err) {
      setErrorMsg(
        err === 'google_failed' || err === 'google_signin_failed'
          ? 'Google authorization was cancelled or failed. Please try again.'
          : decodeURIComponent(err)
      );
    }
  }, [location]);

  useEffect(() => {
    if (!userId) {
      navigate('/login');
      return;
    }

    axios
      .get<GoogleAccountItem[]>(`${API_BASE_URL}/Auth/google-accounts`)
      .then((res) => {
        setAccounts(res.data);
        if (res.data.length > 0) {
          sessionStorage.setItem('isGoogleDriveConnected', 'true');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [navigate, userId]);

  const handleConnectDrive = () => {
    window.location.href = `${API_BASE_URL}/Auth/google-connect`;
  };

  const handleSignOut = async () => {
    try {
      await axios.post(`${API_BASE_URL}/Auth/logout`);
      sessionStorage.clear();
      navigate('/login');
    } catch {
      alert('Sign-out failed. Please try again.');
    }
  };

  return (
    <AuthLayout>
      <div className="auth-login-card" style={{ maxWidth: '500px', textAlign: 'center' }}>
        {/* Official Google Drive Emblem */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <div
            style={{
              width: '84px',
              height: '84px',
              borderRadius: '20px',
              background: '#111317',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 28px rgba(0, 0, 0, 0.4), 0 0 20px rgba(66, 133, 244, 0.15)',
            }}
          >
            <svg width="50" height="50" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
              <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
              <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47" />
              <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
              <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
              <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
              <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
            </svg>
          </div>
        </div>

        <h2 className="auth-login-title" style={{ marginBottom: '8px', textAlign: 'center' }}>
          Connect Google Drive
        </h2>

        <p style={{ color: '#9da3af', fontSize: '0.88rem', lineHeight: '1.5', marginBottom: '24px' }}>
          Encrypz securely stores your client-side encrypted vault files directly on Google Drive. 
          Your plaintext files and encryption keys never leave your device.
        </p>

        {/* Feedback Alerts */}
        {successMsg && (
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#34d399',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              textAlign: 'left',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && <div className="auth-alert-error" role="alert">{errorMsg}</div>}

        {/* Loading State */}
        {loading ? (
          <p style={{ color: '#9da3af', padding: '20px 0' }}>Checking connected accounts...</p>
        ) : (
          <div>
            {/* Connected Accounts Section */}
            {accounts.length > 0 && (
              <div style={{ marginBottom: '24px', textAlign: 'left' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#858b99', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                  Connected Google Accounts ({accounts.length})
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                  {accounts.map((acc) => (
                    <div
                      key={acc.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        background: '#111317',
                        border: '1px solid #2e333e',
                        borderRadius: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Real Google G Icon */}
                        <svg width="18" height="18" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ color: '#ffffff', fontWeight: 600, fontSize: '0.88rem' }}>
                            {acc.email || acc.displayName || 'Google Drive'}
                          </div>
                          {acc.connectedAt && (
                            <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                              Linked {new Date(acc.connectedAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>

                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: '#34d399',
                          fontSize: '0.78rem',
                          fontWeight: 500,
                          background: 'rgba(16, 185, 129, 0.1)',
                          padding: '4px 8px',
                          borderRadius: '12px',
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399' }}></span>
                        Active
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => navigate('/vault')}
                  className="auth-btn-white-full"
                  style={{ marginBottom: '14px' }}
                >
                  Open My Vault
                </button>
              </div>
            )}

            {/* Professional Google Connect Action Button */}
            <button
              onClick={handleConnectDrive}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                width: '100%',
                height: '46px',
                padding: '0 20px',
                background: accounts.length > 0 ? '#16191f' : '#ffffff',
                color: accounts.length > 0 ? '#ffffff' : '#1f1f1f',
                border: accounts.length > 0 ? '1px solid #2e333e' : 'none',
                borderRadius: '8px',
                fontSize: '0.94rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: accounts.length > 0 ? 'none' : '0 4px 14px rgba(0, 0, 0, 0.25)',
              }}
              onMouseEnter={(e) => {
                if (accounts.length === 0) {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                } else {
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (accounts.length === 0) {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                } else {
                  e.currentTarget.style.borderColor = '#2e333e';
                }
              }}
            >
              {/* Real Official Google G Logo */}
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{accounts.length > 0 ? 'Connect Another Google Account' : 'Connect Google Drive'}</span>
            </button>

            <button
              onClick={handleSignOut}
              className="auth-btn-secondary"
              style={{ marginTop: '12px', justifyContent: 'center' }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </AuthLayout>
  );
};
