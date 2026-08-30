import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5207/api';

export const ConnectDrive = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const userId = sessionStorage.getItem('userId');

    useEffect(() => {
        document.title = "Encrypz - Connect Google Drive";
    }, []);

    useEffect(() => {
        if (!userId) {
            navigate('/login');
            return;
        }

        const queryParams = new URLSearchParams(location.search);
        if (queryParams.get('connected') === 'true') {
            sessionStorage.setItem('isGoogleDriveConnected', 'true');
            navigate('/vault');
            return;
        }

        // If already connected, redirect to vault
        if (sessionStorage.getItem('isGoogleDriveConnected') === 'true') {
            navigate('/vault');
        }
    }, [navigate, location, userId]);

    const handleConnectDrive = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/Auth/google-login`);
            window.location.href = res.data.url + `&state=${userId}`;
        } catch (e) {
            console.error("Failed to get Google login URL", e);
            alert("Failed to connect to Google Drive.");
        }
    };

    const handleLogout = () => {
        sessionStorage.clear();
        navigate('/login');
    };

    return (
        <div className="container animate-fade-in text-center" style={{ marginTop: '10vh' }}>
            <div className="glass-panel" style={{ maxWidth: '500px', margin: '0 auto', padding: '40px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="var(--primary-color)" style={{ filter: 'drop-shadow(0 0 8px rgba(0,240,255,0.4))', marginBottom: '20px' }} viewBox="0 0 16 16"><path d="M15.545 6.558a9.42 9.42 0 0 1 .139 1.626c0 2.434-.87 4.492-2.384 5.885h.002C11.978 15.292 10.158 16 8 16A8 8 0 1 1 8 0a7.689 7.689 0 0 1 5.352 2.082l-2.284 2.284A4.347 4.347 0 0 0 8 3.166c-2.087 0-3.86 1.408-4.492 3.304a4.792 4.792 0 0 0 0 3.063h.003c.635 1.893 2.405 3.301 4.492 3.301 1.078 0 2.004-.276 2.722-.764h-.003a3.702 3.702 0 0 0 1.599-2.431H8v-3.08h7.545z"/></svg>
                <h2 style={{ marginBottom: '10px' }}>Connect Cloud Storage</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>
                    Encrypz encrypts your files locally, but requires a cloud provider to securely store the encrypted blobs. Connect your Google Drive to continue.
                </p>
                <button onClick={handleConnectDrive} className="btn btn-primary" style={{ width: '100%', padding: '16px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M15.545 6.558a9.42 9.42 0 0 1 .139 1.626c0 2.434-.87 4.492-2.384 5.885h.002C11.978 15.292 10.158 16 8 16A8 8 0 1 1 8 0a7.689 7.689 0 0 1 5.352 2.082l-2.284 2.284A4.347 4.347 0 0 0 8 3.166c-2.087 0-3.86 1.408-4.492 3.304a4.792 4.792 0 0 0 0 3.063h.003c.635 1.893 2.405 3.301 4.492 3.301 1.078 0 2.004-.276 2.722-.764h-.003a3.702 3.702 0 0 0 1.599-2.431H8v-3.08h7.545z"/></svg>
                    Connect Google Drive
                </button>
                <button onClick={handleLogout} className="btn btn-secondary" style={{ width: '100%', marginTop: '15px' }}>
                    Logout
                </button>
            </div>
        </div>
    );
};
