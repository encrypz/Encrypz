import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    deriveKey, 
    encryptData, 
    arrayBufferToBase64, 
    stringToUint8Array 
} from '../utils/crypto';

const API_BASE_URL = 'http://localhost:5207/api';

export const Upload = () => {
    const navigate = useNavigate();
    const userId = sessionStorage.getItem('userId');
    const masterPassword = sessionStorage.getItem('masterPassword');
    const username = sessionStorage.getItem('username');

    const [uploading, setUploading] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        
        const file = e.target.files[0];
        setUploading(true);
        setSuccessMessage(null);

        try {
            const key = await deriveKey(masterPassword!, username!);
            
            const arrayBuffer = await file.arrayBuffer();
            const fileData = new Uint8Array(arrayBuffer);
            
            const encrypted = await encryptData(fileData, key);
            
            const fileNameB64 = arrayBufferToBase64(stringToUint8Array(file.name));

            const payload = {
                encryptedFileName: fileNameB64,
                payload: arrayBufferToBase64(encrypted.payload),
                initializationVector: arrayBufferToBase64(encrypted.iv),
                authenticationTag: arrayBufferToBase64(encrypted.authTag),
                userId: userId
            };

            await axios.post(`${API_BASE_URL}/Files`, payload);
            setSuccessMessage(`${file.name} encrypted and uploaded successfully!`);
        } catch (error) {
            console.error('Upload failed', error);
            alert('Encryption or upload failed.');
        } finally {
            setUploading(false);
            e.target.value = ''; 
        }
    };

    return (
        <div className="glass-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
            <div className="text-center" style={{ width: '100%', maxWidth: '600px', borderStyle: 'dashed', padding: '60px 40px', borderRadius: '12px', borderColor: 'var(--surface-border)', transition: 'all var(--transition-normal)' }}
                 onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--primary-color)'; e.currentTarget.style.background = 'rgba(0, 240, 255, 0.05)' }}
                 onDragLeave={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--surface-border)'; e.currentTarget.style.background = 'transparent' }}
                 onDrop={(e) => {
                     e.preventDefault();
                     e.currentTarget.style.borderColor = 'var(--surface-border)';
                     e.currentTarget.style.background = 'transparent';
                     if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                         handleFileUpload({ target: { files: e.dataTransfer.files, value: '' } } as any);
                     }
                 }}
            >
                <div style={{ marginBottom: '24px' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" fill="var(--primary-color)" viewBox="0 0 16 16" style={{ filter: 'drop-shadow(0 0 16px rgba(0,240,255,0.4))' }}>
                        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
                        <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/>
                    </svg>
                </div>
                <h2 style={{ margin: '0 0 16px 0' }}>Secure Upload</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '1.05rem' }}>
                    Drag & drop a file here to encrypt it instantly. Your file never touches our servers unencrypted. It is encrypted in your browser and securely stored in your Google Drive.
                </p>
                <div style={{ position: 'relative', display: 'inline-block', width: '100%', maxWidth: '300px' }}>
                    <input 
                        type="file" 
                        onChange={handleFileUpload} 
                        disabled={uploading} 
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                    />
                    <button className="btn btn-primary" style={{ pointerEvents: 'none', width: '100%', padding: '16px', fontSize: '1.1rem' }}>
                        {uploading ? 'Encrypting & Uploading...' : 'Select File'}
                    </button>
                </div>

                {successMessage && (
                    <div className="animate-fade-in" style={{ marginTop: '24px', padding: '16px', background: 'rgba(46, 213, 115, 0.1)', color: 'var(--success-color)', borderRadius: '8px', border: '1px solid var(--success-color)' }}>
                        <p style={{ margin: '0 0 12px 0' }}>{successMessage}</p>
                        <button onClick={() => navigate('/vault')} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
                            View in Vault
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
