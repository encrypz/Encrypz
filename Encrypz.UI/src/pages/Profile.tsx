import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { lockVault } from '../utils/crypto';

const API = import.meta.env.VITE_API_URL || '/api';
export const Profile = () => {
    const navigate = useNavigate();
    const [profile, setProfile] = useState<{ username: string; fileCount: number; folderCount: number } | null>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        document.title = 'Encrypz - Profile';
        axios.get(`${API}/Auth/user/${sessionStorage.getItem('userId')}`).then(r => setProfile(r.data))
            .catch(() => setError('Unable to load your Google Drive profile.'));
    }, []);
    const signOut = async () => {
        try {
            await axios.post(`${API}/Auth/logout`);
            lockVault(); sessionStorage.clear(); navigate('/login');
        } catch { setError('Sign-out failed. Please try again.'); }
    };
    return <div className="glass-panel" style={{ padding: 28 }}>
        <h2>My profile</h2>
        {error && <p role="alert">{error}</p>}
        {profile ? <>
            <p>Google account: <strong>{profile.username}</strong></p>
            <p>{profile.fileCount} encrypted files · {profile.folderCount} folders</p>
            <p>Your vault is stored in this Google account’s private app storage. Each Google account has its own vault.</p>
            <p>Your master password stays in your browser. Reloading the page locks the vault. Google sessions last up to 50 minutes.</p>
            <p>Keep a backup of your vault configuration. Deleting Encrypz’s Google Drive app data can permanently remove your vault.</p>
            <button className="btn btn-secondary" onClick={async () => {
                try {
                    const { data } = await axios.get(`${API}/Auth/session`);
                    const url = URL.createObjectURL(new Blob([JSON.stringify(data.vaultConfig, null, 2)], { type: 'application/json' }));
                    const a = document.createElement('a'); a.href = url; a.download = 'encrypz-vault-config.json'; a.click(); URL.revokeObjectURL(url);
                } catch { setError('Could not download the vault configuration.'); }
            }}>Back up vault configuration</button>
            <p><Link to="/import">Import an older vault</Link></p>
            <button className="btn btn-secondary" onClick={signOut}>Sign out / switch Google account</button>
        </> : !error && <p>Loading profile...</p>}
    </div>;
};
