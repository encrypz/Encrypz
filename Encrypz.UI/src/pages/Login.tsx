import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

type Session = { userId: string; username: string; isGoogleDriveConnected: boolean };

export const Login = () => {
    const registering = useLocation().pathname === '/register';
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [session, setSession] = useState<Session | null>(null);
    const [masterPassword, setMasterPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(new URLSearchParams(window.location.search).has('error')
        ? 'Google sign-in was cancelled or failed. Please try again.' : '');
    const navigate = useNavigate();

    useEffect(() => {
        document.title = 'Encrypz - Sign In';
        sessionStorage.clear();
        axios.get<Session>(`${API_BASE_URL}/Auth/session`)
            .then(({ data }) => setSession(data))
            .catch((err) => {
                if (err.response?.status !== 401) setError('Cannot reach the sign-in service. Please try again.');
            })
            .finally(() => setLoading(false));
    }, []);

    const submitCredentials = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        if (registering && password !== confirmation) {
            setError('The account passwords do not match.');
            return;
        }
        setSubmitting(true);
        try {
            const { data } = await axios.post<Session>(`${API_BASE_URL}/Auth/${registering ? 'register' : 'login'}`, { username, password });
            setPassword('');
            setConfirmation('');
            setSession(data);
        } catch (err) {
            const response = axios.isAxiosError(err) ? err.response : undefined;
            setError(response?.status === 429 ? 'Too many attempts. Please wait a minute and try again.'
                : typeof response?.data === 'string' ? response.data : 'Unable to sign in or create the account. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const unlock = (event: React.FormEvent) => {
        event.preventDefault();
        if (!session || !masterPassword) return;
        sessionStorage.setItem('userId', session.userId);
        sessionStorage.setItem('username', session.username);
        sessionStorage.setItem('masterPassword', masterPassword);
        sessionStorage.setItem('isGoogleDriveConnected', String(session.isGoogleDriveConnected));
        navigate(session.isGoogleDriveConnected ? '/vault' : '/connect');
    };

    const signOut = async () => {
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
        <div className="container animate-fade-in" style={{ maxWidth: '500px', paddingTop: '10vh' }}>
            <div className="glass-panel" style={{ padding: '40px' }}>
                <div className="text-center mb-4">
                    <img src="/logo.png" alt="Encrypz" style={{ height: '72px', borderRadius: '8px' }} />
                    <h1>Encrypz</h1>
                    <p>{session ? 'Unlock your encrypted vault' : 'Your private Google Drive vault'}</p>
                </div>
                {error && <p role="alert" style={{ color: 'var(--danger-color)' }}>{error}</p>}
                {loading ? <p role="status">Checking your session…</p> : session ? (
                    <form onSubmit={unlock} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <p>Signed in as {session.username}</p>
                        <label htmlFor="master-password">Master password</label>
                        <input id="master-password" type="password" autoComplete="current-password" required
                            value={masterPassword} onChange={event => setMasterPassword(event.target.value)} />
                        <p style={{ color: 'var(--text-muted)' }}>
                            Enter your existing vault password, or choose a strong password for a new vault.
                            Use a different password from your account password. This master password stays in this browser tab and encrypts your files.
                            Google cannot recover it. A different password cannot decrypt existing files.
                        </p>
                        <button className="btn btn-primary" type="submit">Unlock vault</button>
                        <button className="btn btn-secondary" type="button" onClick={signOut}>Sign out</button>
                    </form>
                ) : (
                    <>
                        <h2>{registering ? 'Create your account' : 'Sign in'}</h2>
                        <form onSubmit={submitCredentials} style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '20px 0' }}>
                            <label htmlFor="username">Username</label>
                            <input id="username" autoComplete="username" required minLength={3} maxLength={32}
                                pattern="[A-Za-z0-9_]{3,32}" title="3–32 letters, numbers, or underscores"
                                value={username} onChange={event => setUsername(event.target.value)} />
                            <label htmlFor="account-password">Account password</label>
                            <input id="account-password" type="password" required minLength={12} maxLength={128}
                                autoComplete={registering ? 'new-password' : 'current-password'}
                                value={password} onChange={event => setPassword(event.target.value)} />
                            {registering && <>
                                <label htmlFor="confirm-password">Confirm account password</label>
                                <input id="confirm-password" type="password" autoComplete="new-password" required
                                    value={confirmation} onChange={event => setConfirmation(event.target.value)} />
                                <p style={{ color: 'var(--text-muted)' }}>Use at least 12 characters. After creating your account, choose a separate master password to encrypt your vault.</p>
                            </>}
                            <button className="btn btn-primary" type="submit" disabled={submitting}>
                                {submitting ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}
                            </button>
                        </form>
                        <button type="button" className="btn btn-secondary" style={{ width: '100%', marginBottom: '16px' }}
                            onClick={() => { setError(''); setPassword(''); setConfirmation(''); navigate(registering ? '/login' : '/register'); }}>
                            {registering ? 'Already have an account? Sign in' : 'Create an account'}
                        </button>
                        <p className="text-center" style={{ marginBottom: '16px' }}>Or use your Google account</p>
                        <button className="btn btn-primary" style={{ width: '100%' }}
                            onClick={() => { window.location.href = `${API_BASE_URL}/Auth/google-login`; }}>
                            Continue with Google
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};
