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
                        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
                        <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/>
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
