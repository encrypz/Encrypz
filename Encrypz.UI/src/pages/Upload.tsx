import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { generateThumbnailBytes } from '../utils/media';
import { 
    deriveKey, 
    encryptData, 
    arrayBufferToBase64, 
    stringToUint8Array 
} from '../utils/crypto';

const API_BASE_URL = 'http://localhost:5207/api';



export const Upload = () => {

    const navigate = useNavigate();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const folderId = queryParams.get('folderId');

    const userId = sessionStorage.getItem('userId');
    const masterPassword = sessionStorage.getItem('masterPassword');
    const username = sessionStorage.getItem('username');

    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<{current: number, total: number} | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        
        const files = Array.from(e.target.files);
        setUploading(true);
        setSuccessMessage(null);
        setUploadProgress({ current: 0, total: files.length });

        try {
            const key = await deriveKey(masterPassword!, username!);
            let successCount = 0;
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                setUploadProgress({ current: i + 1, total: files.length });
                
                const arrayBuffer = await file.arrayBuffer();
                const fileData = new Uint8Array(arrayBuffer);
                
                const encrypted = await encryptData(fileData, key);
                
                const fileNameB64 = arrayBufferToBase64(stringToUint8Array(file.name));

                let encryptedThumbnail = null;
                let thumbnailIv = null;
                let thumbnailAuthTag = null;

                const thumbnailBytes = await generateThumbnailBytes(file);
                if (thumbnailBytes) {
                    try {
                        const thumbEncrypted = await encryptData(thumbnailBytes, key);
                        encryptedThumbnail = arrayBufferToBase64(thumbEncrypted.payload);
                        thumbnailIv = arrayBufferToBase64(thumbEncrypted.iv);
                        thumbnailAuthTag = arrayBufferToBase64(thumbEncrypted.authTag);
                    } catch (e) {
                        console.error("Thumbnail encryption failed", e);
                    }
                }

                const payload = {
                    encryptedFileName: fileNameB64,
                    payload: arrayBufferToBase64(encrypted.payload),
                    initializationVector: arrayBufferToBase64(encrypted.iv),
                    authenticationTag: arrayBufferToBase64(encrypted.authTag),
                    userId: userId,
                    folderId: folderId,
                    encryptedThumbnail: encryptedThumbnail,
                    thumbnailIv: thumbnailIv,
                    thumbnailAuthTag: thumbnailAuthTag
                };

                await axios.post(`${API_BASE_URL}/Files`, payload);
                successCount++;
            }
            setSuccessMessage(`${successCount} file(s) encrypted and uploaded successfully!`);
        } catch (error) {
            console.error('Upload failed', error);
            alert('Encryption or upload failed for one or more files.');
        } finally {
            setUploading(false);
            setUploadProgress(null);
            e.target.value = ''; 
        }
    };

    return (
        <div className="glass-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
            <div className="text-center" style={{ width: '100%', maxWidth: '600px', borderStyle: 'dashed', padding: '60px 40px', borderRadius: 'var(--border-radius)', borderColor: 'var(--border-color)', transition: 'all var(--transition-normal)' }}
                 onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'rgba(0, 240, 255, 0.05)' }}
                 onDragLeave={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.background = 'transparent' }}
                 onDrop={(e) => {
                     e.preventDefault();
                     e.currentTarget.style.borderColor = 'var(--border-color)';
                     e.currentTarget.style.background = 'transparent';
                     if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                         handleFileUpload({ target: { files: e.dataTransfer.files, value: '' } } as any);
                     }
                 }}
            >
                <div style={{ marginBottom: '24px' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" fill="var(--primary)" viewBox="0 0 16 16" style={{ filter: 'drop-shadow(2px 2px 0px rgba(0,0,0,1))' }}>
                        <path d="M15.545 6.558a9.42 9.42 0 0 1 .139 1.626c0 2.434-.87 4.492-2.384 5.885h.002C11.978 15.292 10.158 16 8 16A8 8 0 1 1 8 0a7.689 7.689 0 0 1 5.352 2.082l-2.284 2.284A4.347 4.347 0 0 0 8 3.166c-2.087 0-3.86 1.408-4.492 3.304a4.792 4.792 0 0 0 0 3.063h.003c.635 1.893 2.405 3.301 4.492 3.301 1.078 0 2.004-.276 2.722-.764h-.003a3.702 3.702 0 0 0 1.599-2.431H8v-3.08h7.545z"/>
                    </svg>
                </div>
                <h2 style={{ margin: '0 0 16px 0' }}>Secure Upload</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '1.05rem' }}>
                    Drag & drop files here to encrypt them instantly. Your file never touches our servers unencrypted. It is encrypted in your browser and securely stored in your Google Drive.
                </p>
                <div style={{ position: 'relative', display: 'inline-block', width: '100%', maxWidth: '300px' }}>
                    <input 
                        type="file" 
                        multiple
                        onChange={handleFileUpload} 
                        disabled={uploading} 
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                    />
                    <button className="btn btn-primary" style={{ pointerEvents: 'none', width: '100%', padding: '16px', fontSize: '1.1rem' }}>
                        {uploading && uploadProgress ? `Encrypting ${uploadProgress.current} of ${uploadProgress.total}...` : uploading ? 'Encrypting...' : 'Select Files'}
                    </button>
                </div>

                {successMessage && (
                    <div className="animate-fade-in" style={{ marginTop: '24px', padding: '16px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-color)', borderRadius: '8px', border: '1px solid var(--success-color)' }}>
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
