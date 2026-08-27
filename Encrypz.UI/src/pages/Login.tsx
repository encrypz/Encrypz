import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5207/api';

export const Login = () => {
    const [isRegister, setIsRegister] = useState(false);
    const [username, setUsername] = useState('');
    const [masterPassword, setMasterPassword] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
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
