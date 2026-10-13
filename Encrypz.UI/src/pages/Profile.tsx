import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface GoogleAccountItem {
    id: string;
    email?: string;
    displayName?: string;
    connectedAt: string;
}

interface UserProfile {
    username: string;
    isGoogleDriveConnected: boolean;
    fileCount: number;
    folderCount: number;
    googleAccounts?: GoogleAccountItem[];
}

export const Profile = () => {
    const navigate = useNavigate();
    const userId = sessionStorage.getItem('userId');
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionMessage, setActionMessage] = useState<string | null>(null);

    useEffect(() => {
        document.title = "Encrypz - User Profile";
    }, []);

    useEffect(() => {
        if (userId) {
            fetchProfile();
        } else {
            navigate('/');
        }
    }, [userId, navigate]);

    const fetchProfile = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/Auth/user/${userId}`);
            setProfile(response.data);
            if (response.data.isGoogleDriveConnected) {
                sessionStorage.setItem('isGoogleDriveConnected', 'true');
            }
        } catch (error) {
            console.error('Failed to fetch profile', error);
        } finally {
            setLoading(false);
        }
    };

    const handleConnectAnotherGoogle = () => {
        window.location.href = `${API_BASE_URL}/Auth/google-connect`;
    };

    const handleDisconnectAccount = async (accountId: string) => {
        if (!confirm('Are you sure you want to disconnect this Google Drive account?')) return;
        try {
            await axios.delete(`${API_BASE_URL}/Auth/google-accounts/${accountId}`);
            setActionMessage('Google account disconnected.');
            setTimeout(() => setActionMessage(null), 4000);
            await fetchProfile();
        } catch (error) {
            console.error('Failed to disconnect account', error);
            alert('Could not disconnect account. Please try again.');
        }
    };

    const handleSignOut = () => {
        sessionStorage.clear();
        navigate('/');
    };

    if (loading) {
        return (
            <div className="glass-panel animate-fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <span style={{ color: 'var(--primary-color)', fontSize: '1.2rem', animation: 'pulse 1.5s infinite' }}>Loading Profile...</span>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="glass-panel animate-fade-in text-center" style={{ height: '100%' }}>
                <h3>Failed to load profile.</h3>
            </div>
        );
    }

    return (
        <div className="glass-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ marginBottom: '32px', paddingBottom: '16px', borderBottom: '1px solid var(--surface-border)' }}>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="var(--primary-color)" viewBox="0 0 16 16">
                        <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
                        <path fillRule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1z"/>
                    </svg>
                    My Profile
                </h2>
            </div>

            {actionMessage && (
                <div style={{ background: 'rgba(0, 240, 255, 0.1)', border: '1px solid var(--primary-color)', color: 'var(--primary-color)', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' }}>
                    {actionMessage}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '650px' }}>
                {/* Account Details */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '12px', border: '1px solid var(--surface-border)' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.2rem' }}>Account Details</h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Username</span>
                        <span style={{ fontWeight: 600 }}>{profile.username}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Encrypted Files</span>
                        <span style={{ fontWeight: 600 }}>{profile.fileCount}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Secure Folders</span>
                        <span style={{ fontWeight: 600 }}>{profile.folderCount}</span>
                    </div>
                </div>

                {/* Connected Cloud Storage Accounts */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '12px', border: '1px solid var(--surface-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Connected Google Accounts</h3>
                        <span style={{
                            background: profile.isGoogleDriveConnected ? 'rgba(46, 213, 115, 0.1)' : 'rgba(255, 71, 87, 0.1)',
                            color: profile.isGoogleDriveConnected ? 'var(--success-color)' : 'var(--danger-color)',
                            padding: '4px 12px',
                            borderRadius: '100px',
                            fontSize: '0.85rem',
                            fontWeight: 600
                        }}>
                            {profile.isGoogleDriveConnected ? `${profile.googleAccounts?.length || 1} Account(s) Connected` : 'Not Connected'}
                        </span>
                    </div>

                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
                        You can link multiple Google accounts to your Encrypz vault. All files uploaded under your username <strong>{profile.username}</strong> remain strictly private and accessible only by you.
                    </p>

                    {/* Account list */}
                    {profile.googleAccounts && profile.googleAccounts.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                            {profile.googleAccounts.map((account, idx) => (
                                <div key={account.id} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '12px 16px',
                                    background: 'rgba(255,255,255,0.03)',
                                    borderRadius: '8px',
                                    border: '1px solid var(--surface-border)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="var(--success-color)" viewBox="0 0 16 16">
                                            <path d="M15.545 6.558a9.42 9.42 0 0 1 .139 1.626c0 2.434-.87 4.492-2.384 5.885h.002C11.978 15.292 10.158 16 8 16A8 8 0 1 1 8 0a7.689 7.689 0 0 1 5.352 2.082l-2.284 2.284A4.347 4.347 0 0 0 8 3.166c-2.087 0-3.86 1.408-4.492 3.304a4.792 4.792 0 0 0 0 3.063h.003c.635 1.893 2.405 3.301 4.492 3.301 1.078 0 2.004-.276 2.722-.764h-.003a3.702 3.702 0 0 0 1.599-2.431H8v-3.08h7.545z"/>
                                        </svg>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                                                {account.email || account.displayName || `Google Account #${idx + 1}`}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                Connected: {new Date(account.connectedAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleDisconnectAccount(account.id)}
                                        className="btn btn-secondary danger"
                                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                        title="Disconnect this Google Drive"
                                    >
                                        Disconnect
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            No Google accounts connected yet.
                        </div>
                    )}

                    {/* Connect Another Google Account Button */}
                    <button 
                        onClick={handleConnectAnotherGoogle} 
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '12px' }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                        {profile.isGoogleDriveConnected ? 'Connect Another Google Account' : 'Connect Google Drive'}
                    </button>
                </div>

                {/* Actions */}
                <div style={{ marginTop: '8px' }}>
                    <button onClick={handleSignOut} className="btn btn-secondary danger" style={{ padding: '12px 24px', fontSize: '1rem', width: '100%', maxWidth: '200px' }}>
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Profile;
