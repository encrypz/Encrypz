import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5207/api';

export const Login = () => {
    const [username, setUsername] = useState('');
    const [masterPassword, setMasterPassword] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        document.title = "Encrypz - Secure Login";
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            const response = await axios.post(`${API_BASE_URL}/Auth/login`, { username });
            const { userId, isGoogleDriveConnected } = response.data;
            
            sessionStorage.setItem('userId', userId);
            sessionStorage.setItem('masterPassword', masterPassword);
            sessionStorage.setItem('username', username);
            sessionStorage.setItem('isGoogleDriveConnected', isGoogleDriveConnected ? 'true' : 'false');

            navigate('/vault');
        } catch (error: any) {
            console.error('Authentication failed', error);
            const msg = error.response?.data || 'Failed to authenticate. Please check if the API is running.';
            alert(msg);
        }
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }} className="animate-fade-in">
            {/* Left Side: Illustration */}
            <div style={{ 
                flex: 1, 
                display: 'none', 
                alignItems: 'center', 
                justifyContent: 'center',
                backgroundImage: 'url(/auth_hero.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative'
            }} className="auth-hero-img">
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(10,10,10,0.2), var(--bg-color))' }}></div>
            </div>
            
            {/* Right Side: Form */}
            <div style={{ 
                flex: 1, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: '40px',
                background: 'var(--bg-color)'
            }}>
                <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 10 }}>
                <div className="text-center mb-4">
                    <img src="/logo.png" alt="Encrypz Logo" style={{ height: '72px', width: 'auto', borderRadius: '8px', marginBottom: '4px' }} />
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)', letterSpacing: '1px', marginBottom: '12px' }}>ENCRYPZ</div>
                    <p style={{ color: 'var(--text-muted)', marginTop: '4px', fontSize: '1.1rem', marginBottom: '16px' }}>
                        Access your Vault
                    </p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                        <label style={{ marginBottom: '4px' }}>Username</label>
                        <input 
                            type="text" 
                            value={username} 
                            onChange={(e) => setUsername(e.target.value)} 
                            required 
                            placeholder="Enter username"
                            style={{ padding: '10px 14px' }}
                        />
                    </div>
                    <div>
                        <label style={{ marginBottom: '4px' }}>Master Password (Encryption Key)</label>
                        <input 
                            type="password" 
                            value={masterPassword} 
                            onChange={(e) => setMasterPassword(e.target.value)} 
                            required 
                            placeholder="Enter master password"
                            style={{ padding: '10px 14px' }}
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ marginTop: '8px', padding: '10px' }}>
                        Unlock Vault
                    </button>
                </form>
                <div className="text-center" style={{ marginTop: '16px' }}>
                    <button 
                        type="button" 
                        onClick={() => navigate('/register')} 
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', transition: 'color 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                        Don't have an account? Register
                    </button>
                </div>
            </div>
            </div>
        </div>
    );
};
