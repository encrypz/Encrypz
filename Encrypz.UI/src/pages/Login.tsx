import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5207/api';

export const Login = () => {
    const [isRegister, setIsRegister] = useState(false);
    const [username, setUsername] = useState('');
    const [masterPassword, setMasterPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        document.title = "Encrypz - Secure Login & Registration";
    }, []);

    const isStrongPassword = (password: string) => {
        const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/?])[A-Za-z\d@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/;
        return regex.test(password);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (isRegister) {
            if (masterPassword !== confirmPassword) {
                alert('Passwords do not match.');
                return;
            }
            if (!isStrongPassword(masterPassword)) {
                alert('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.');
                return;
            }
        }

        try {
            const endpoint = isRegister ? 'register' : 'login';
            const response = await axios.post(`${API_BASE_URL}/Auth/${endpoint}`, { username });
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
                        {isRegister ? 'Create your Vault' : 'Access your Vault'}
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
                    {isRegister && (
                        <>
                            <div>
                                <label style={{ marginBottom: '4px' }}>Confirm Master Password</label>
                                <input 
                                    type="password" 
                                    value={confirmPassword} 
                                    onChange={(e) => setConfirmPassword(e.target.value)} 
                                    required 
                                    placeholder="Confirm master password"
                                    style={{ padding: '10px 14px' }}
                                />
                            </div>
                            <div style={{ background: 'rgba(255, 71, 87, 0.1)', border: '1px solid var(--danger-color)', padding: '10px', borderRadius: '8px', color: 'var(--danger-color)', fontSize: '0.85rem', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginTop: '2px', flexShrink: 0 }}>
                                    <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
                                </svg>
                                <div style={{ lineHeight: '1.4' }}>
                                    <strong>Lost passwords cannot be recovered.</strong> We do not store keys. If forgotten, you will lose data access forever.
                                </div>
                            </div>
                        </>
                    )}
                    <button type="submit" className="btn btn-primary" style={{ marginTop: '8px', padding: '10px' }}>
                        {isRegister ? 'Create Account & Encrypt' : 'Unlock Vault'}
                    </button>
                </form>
                <div className="text-center" style={{ marginTop: '16px' }}>
                    <button 
                        type="button" 
                        onClick={() => setIsRegister(!isRegister)} 
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', transition: 'color 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                        {isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
                    </button>
                </div>
            </div>
            </div>
        </div>
    );
};
