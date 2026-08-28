import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5207/api';

export const Login = () => {
    const [isRegister, setIsRegister] = useState(false);
    const [username, setUsername] = useState('');
    const [masterPassword, setMasterPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (isRegister && masterPassword !== confirmPassword) {
            alert('Passwords do not match.');
            return;
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
        <div className="auth-container animate-fade-in">
            <div className="glass-panel" style={{ width: '100%', maxWidth: '420px' }}>
                <h2 className="text-center mb-4">
                    <span style={{ color: 'var(--primary-color)' }}>Encrypz</span><br/>
                    {isRegister ? 'Create your Vault' : 'Access your Vault'}
                </h2>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <label>Username</label>
                        <input 
                            type="text" 
                            value={username} 
                            onChange={(e) => setUsername(e.target.value)} 
                            required 
                            placeholder="Enter username"
                        />
                    </div>
                    <div>
                        <label>Master Password (Encryption Key)</label>
                        <input 
                            type="password" 
                            value={masterPassword} 
                            onChange={(e) => setMasterPassword(e.target.value)} 
                            required 
                            placeholder="Enter master password"
                        />
                    </div>
                    {isRegister && (
                        <>
                            <div>
                                <label>Confirm Master Password</label>
                                <input 
                                    type="password" 
                                    value={confirmPassword} 
                                    onChange={(e) => setConfirmPassword(e.target.value)} 
                                    required 
                                    placeholder="Confirm master password"
                                />
                            </div>
                            <div style={{ background: 'rgba(255, 71, 87, 0.1)', border: '1px solid var(--danger-color)', padding: '12px', borderRadius: '8px', color: 'var(--danger-color)', fontSize: '0.9rem', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginTop: '2px', flexShrink: 0 }}>
                                    <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
                                </svg>
                                <div>
                                    <strong>Important:</strong> We do not store your master password on our servers. If you forget your password, it cannot be reset and you will lose access to your encrypted data forever.
                                </div>
                            </div>
                        </>
                    )}
                    <button type="submit" className="btn btn-primary mt-4">
                        {isRegister ? 'Create Account & Encrypt' : 'Unlock Vault'}
                    </button>
                </form>
                <div className="text-center" style={{ marginTop: '24px' }}>
                    <button 
                        type="button" 
                        onClick={() => setIsRegister(!isRegister)} 
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'color 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                    >
                        {isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
                    </button>
                </div>
            </div>
        </div>
    );
};
