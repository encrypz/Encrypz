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

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Encrypz - Sign Up';
  }, []);

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!termsAgreed) {
      setError('Please agree to the Terms of Service to continue.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmation) {
      setError('The account passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await axios.post<Session>(`${API_BASE_URL}/Auth/register`, {
        username: username.trim(),
        password,
      });

      sessionStorage.setItem('userId', data.userId);
      sessionStorage.setItem('username', data.username);
      sessionStorage.setItem('masterPassword', password);
      sessionStorage.setItem('isGoogleDriveConnected', String(data.isGoogleDriveConnected));

      navigate(data.isGoogleDriveConnected ? '/vault' : '/connect');
    } catch (err) {
      const response = axios.isAxiosError(err) ? err.response : undefined;
      if (response?.status === 429) {
        setError('Too many attempts. Please wait a minute and try again.');
      } else if (typeof response?.data === 'string') {
        setError(response.data);
      } else {
        setError('Unable to create the account. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="auth-register-card">
        {/* Left Column: Form */}
        <div className="auth-register-left">
          <div className="auth-card-title">
            <Link to="/login" className="auth-back-arrow" title="Back to login" aria-label="Back to login">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </Link>
            <span>
              Create your <span className="auth-accent-text">free</span> Encrypz account
            </span>
          </div>

          <div className="auth-card-sub">
            Already have an account?{' '}
            <Link to="/login" className="auth-link-bold">
              Log in
            </Link>
          </div>

          {error && <div className="auth-alert-error" role="alert">{error}</div>}

          <form onSubmit={handleRegister}>
            <div className="auth-form-group">
              <label className="auth-label" htmlFor="register-username">Username</label>
              <input
                id="register-username"
                className="auth-input"
                type="text"
                autoComplete="username"
                required
                minLength={3}
                maxLength={32}
                pattern="[A-Za-z0-9_]{3,32}"
                title="3–32 letters, numbers, or underscores"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="auth-form-group">
              <label className="auth-label" htmlFor="register-password">Password</label>
              <input
                id="register-password"
                className="auth-input"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                maxLength={128}
                placeholder="Enter password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="auth-form-group">
              <label className="auth-label" htmlFor="register-confirm">Confirm password</label>
              <input
                id="register-confirm"
                className="auth-input"
                type="password"
                autoComplete="new-password"
                required
                placeholder="Re-enter password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </div>

            <div className="auth-terms-row">
              <input
                id="terms-check"
                type="checkbox"
                className="auth-checkbox"
                checked={termsAgreed}
                onChange={(e) => setTermsAgreed(e.target.checked)}
                required
              />
              <label htmlFor="terms-check" style={{ cursor: 'pointer' }}>
                By signing up, I agree that I have read and understand Encrypz's{' '}
                <a
                  href="#terms"
                  className="auth-link-bold"
                  onClick={(e) => {
                    e.preventDefault();
                    alert('Encrypz uses zero-knowledge client-side encryption. Keep your password safe as it cannot be recovered by administrators.');
                  }}
                >
                  Terms of Service
                </a>
              </label>
            </div>

            <div className="auth-button-row">
              <button
                type="submit"
                className="auth-btn-white"
                disabled={submitting}
              >
                {submitting ? 'Signing up...' : 'Sign up'}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Benefits */}
        <div className="auth-register-right">
          <h3 className="auth-benefits-header">You'll get</h3>

          {/* Benefit 1 */}
          <div className="auth-benefit-item">
            <svg className="auth-benefit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <div>
              <div className="auth-benefit-title">End-to-end encrypted storage</div>
              <div className="auth-benefit-desc">
                Zero-knowledge encryption. No one, not even Encrypz can see your data.
              </div>
            </div>
          </div>

          {/* Benefit 2 */}
          <div className="auth-benefit-item">
            <svg className="auth-benefit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            <div>
              <div className="auth-benefit-title">Sync and backup your devices</div>
              <div className="auth-benefit-desc">
                By accessing your vault, you can keep your files and folders safe, synced, and private.
              </div>
            </div>
          </div>

          {/* Benefit 3 */}
          <div className="auth-benefit-item">
            <svg className="auth-benefit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path>
              <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path>
              <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path>
              <path d="M12 9V4s3.03.55 4 2c1.08 1.62 0 5 0 5"></path>
            </svg>
            <div>
              <div className="auth-benefit-title">Upgrade and you'll get more features</div>
              <div className="auth-benefit-desc">
                Multi-account cloud storage pooling, client-side encryption keys, and isolated vaults.
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
};
