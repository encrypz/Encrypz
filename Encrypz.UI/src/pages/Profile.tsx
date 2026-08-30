import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5207/api';

interface UserProfile {
    username: string;
    isGoogleDriveConnected: boolean;
    fileCount: number;
    folderCount: number;
}

export const Profile = () => {
    const navigate = useNavigate();
    const userId = sessionStorage.getItem('userId');
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

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
        } catch (error) {
            console.error('Failed to fetch profile', error);
        } finally {
            setLoading(false);
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '600px' }}>
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

                {/* Cloud Storage */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '12px', border: '1px solid var(--surface-border)' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.2rem' }}>Cloud Storage</h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill={profile.isGoogleDriveConnected ? 'var(--success-color)' : 'var(--text-secondary)'} viewBox="0 0 16 16">
                                <path d="M15.545 6.558a9.42 9.42 0 0 1 .139 1.626c0 2.434-.87 4.492-2.384 5.885h.002C11.978 15.292 10.158 16 8 16A8 8 0 1 1 8 0a7.689 7.689 0 0 1 5.352 2.082l-2.284 2.284A4.347 4.347 0 0 0 8 3.166c-2.087 0-3.86 1.408-4.492 3.304a4.792 4.792 0 0 0 0 3.063h.003c.635 1.893 2.405 3.301 4.492 3.301 1.078 0 2.004-.276 2.722-.764h-.003a3.702 3.702 0 0 0 1.599-2.431H8v-3.08h7.545z"/>
                            </svg>
                            <span style={{ color: 'var(--text-secondary)' }}>Google Drive Integration</span>
                        </div>
                        {profile.isGoogleDriveConnected ? (
                            <span style={{ background: 'rgba(46, 213, 115, 0.1)', color: 'var(--success-color)', padding: '4px 12px', borderRadius: '100px', fontSize: '0.85rem', fontWeight: 600 }}>
                                Connected
                            </span>
                        ) : (
                            <span style={{ background: 'rgba(255, 71, 87, 0.1)', color: 'var(--danger-color)', padding: '4px 12px', borderRadius: '100px', fontSize: '0.85rem', fontWeight: 600 }}>
                                Not Connected
                            </span>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div style={{ marginTop: '16px' }}>
                    <button onClick={handleSignOut} className="btn btn-secondary danger" style={{ padding: '12px 24px', fontSize: '1rem', width: '100%', maxWidth: '200px' }}>
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Profile;
