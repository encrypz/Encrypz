import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5207/api';

export const ConnectDrive = () => {
    const navigate = useNavigate();
    const userId = sessionStorage.getItem('userId');

    useEffect(() => {
        // If already connected, redirect to vault
        if (sessionStorage.getItem('isGoogleDriveConnected') === 'true') {
            navigate('/vault');
        }
    }, [navigate]);

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
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="var(--primary-color)" viewBox="0 0 16 16" style={{ filter: 'drop-shadow(0 0 8px rgba(0,240,255,0.4))', marginBottom: '20px' }}>
                    <path d="M15.224 4.582a.5.5 0 0 0-.448-.282H8.736L7.202 1.63A.5.5 0 0 0 6.776 1.4H.776a.5.5 0 0 0-.448.282l-3.5 7A.5.5 0 0 0-3 9.4h6.488l1.534 2.67a.5.5 0 0 0 .426.23h6.776a.5.5 0 0 0 .448-.282l3.5-7a.5.5 0 0 0 0-.436z"/>
                </svg>
                <h2 style={{ marginBottom: '10px' }}>Connect Cloud Storage</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>
                    Encrypz encrypts your files locally, but requires a cloud provider to securely store the encrypted blobs. Connect your Google Drive to continue.
                </p>
                <button onClick={handleConnectDrive} className="btn btn-primary" style={{ width: '100%', padding: '16px', fontSize: '1.1rem' }}>
                    Connect Google Drive
                </button>
                <button onClick={handleLogout} className="btn btn-secondary" style={{ width: '100%', marginTop: '15px' }}>
                    Logout
                </button>
            </div>
        </div>
    );
};
