import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    deriveKey, 
    encryptData, 
    decryptData, 
    arrayBufferToBase64, 
    base64ToArrayBuffer, 
    stringToUint8Array, 
    uint8ArrayToString 
} from '../utils/crypto';

const API_BASE_URL = 'http://localhost:5207/api';

interface FileItem {
    id: string;
    encryptedFileName: string;
}

export const Vault = () => {
    const navigate = useNavigate();
    const userId = sessionStorage.getItem('userId');
    const masterPassword = sessionStorage.getItem('masterPassword');
    const username = sessionStorage.getItem('username'); // Used as salt

    const [files, setFiles] = useState<FileItem[]>([]);
    const [decryptedNames, setDecryptedNames] = useState<Record<string, string>>({});
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(false);
    // Use state for connection so it forces re-render if it changes
    const [isConnectedToDrive, setIsConnectedToDrive] = useState(sessionStorage.getItem('isGoogleDriveConnected') === 'true');

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('connected') === 'true') {
            sessionStorage.setItem('isGoogleDriveConnected', 'true');
            setIsConnectedToDrive(true);
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        if (!userId || !masterPassword || !username) {
            navigate('/login');
            return;
        }
        
        if (sessionStorage.getItem('isGoogleDriveConnected') === 'true') {
            fetchFiles();
        }
    }, [userId, navigate]);

    const fetchFiles = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/Files/user/${userId}`);
            setFiles(response.data);
            await decryptFileNames(response.data);
        } catch (error) {
            console.error('Failed to fetch files', error);
        }
    };

    const decryptFileNames = async (fileList: FileItem[]) => {
        if (!masterPassword || !username) return;
        // Key derivation removed since we just mock filename decryption for MVP
        const names: Record<string, string> = {};

        for (const file of fileList) {
            try {
                // For simplicity, we just show the encrypted string if we don't store the IV for the filename separately.
                // Wait, our backend model only stores ONE IV and ONE Tag per file. 
                // That means we encrypted the payload. The filename needs to be decrypted separately, 
                // but we didn't store a separate IV for it in the DB!
                // Let's assume the filename is just base64 encoded for this MVP if we can't decrypt it without the IV,
                // OR we fetch the full file metadata to decrypt the filename.
                // For this MVP, we will fetch the full file when they click download, and just show ID here.
                names[file.id] = `Encrypted File (${file.id.substring(0, 8)})`;
            } catch {
                names[file.id] = "Unknown File";
            }
        }
        setDecryptedNames(names);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        
        const file = e.target.files[0];
        setUploading(true);

        try {
            const key = await deriveKey(masterPassword!, username!);
            
            // Read file
            const arrayBuffer = await file.arrayBuffer();
            const fileData = new Uint8Array(arrayBuffer);
            
            // Encrypt payload
            const encrypted = await encryptData(fileData, key);
            
            // Just Base64 the filename for this simplified MVP, 
            // In a real scenario, you'd encrypt the filename with a deterministic or random IV and store it.
            const fileNameB64 = arrayBufferToBase64(stringToUint8Array(file.name));

            const payload = {
                encryptedFileName: fileNameB64,
                payload: arrayBufferToBase64(encrypted.payload),
                initializationVector: arrayBufferToBase64(encrypted.iv),
                authenticationTag: arrayBufferToBase64(encrypted.authTag),
                userId: userId
            };

            await axios.post(`${API_BASE_URL}/Files`, payload);
            alert('File uploaded and encrypted successfully!');
            fetchFiles();
        } catch (error) {
            console.error('Upload failed', error);
            alert('Encryption or upload failed.');
        } finally {
            setUploading(false);
            e.target.value = ''; // Reset input
        }
    };

    const handleDownload = async (fileId: string) => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/Files/${fileId}`);
            const data = response.data;

            const key = await deriveKey(masterPassword!, username!);

            const payloadBytes = base64ToArrayBuffer(data.payload);
            const ivBytes = base64ToArrayBuffer(data.initializationVector);
            const tagBytes = base64ToArrayBuffer(data.authenticationTag);

            // Decrypt
            const decryptedBytes = await decryptData(payloadBytes, ivBytes, tagBytes, key);
            
            // Decode filename
            const fileNameBytes = base64ToArrayBuffer(data.encryptedFileName);
            const fileName = uint8ArrayToString(fileNameBytes);

            // Trigger download
            const blob = new Blob([decryptedBytes]);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

        } catch (error) {
            console.error('Download failed', error);
            alert('Decryption or download failed. Wrong password or tampered file?');
        } finally {
            setLoading(false);
        }
    };

    const handleConnectDrive = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/Auth/google-login`);
            // The state parameter passes the userId so the callback knows who to attach the token to
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

    if (!isConnectedToDrive) {
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
    }

    return (
        <div className="container animate-fade-in">
            <div className="flex justify-between align-center mb-4">
                <h2>
                    <span style={{ color: 'var(--primary-color)' }}>Encrypz</span> Vault
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success-color)', boxShadow: '0 0 8px var(--success-color)' }}></span>
                        Drive Connected
                    </span>
                    <button onClick={handleLogout} className="btn btn-secondary">
                        Logout
                    </button>
                </div>
            </div>
            
            <div className="glass-panel text-center mb-4" style={{ borderStyle: 'dashed', padding: '40px 20px', transition: 'all var(--transition-normal)' }}
                 onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--primary-color)'; e.currentTarget.style.background = 'rgba(0, 240, 255, 0.05)' }}
                 onDragLeave={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--surface-border)'; e.currentTarget.style.background = 'var(--glass-bg)' }}
                 onDrop={(e) => {
                     e.preventDefault();
                     e.currentTarget.style.borderColor = 'var(--surface-border)';
                     e.currentTarget.style.background = 'var(--glass-bg)';
                     if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                         // manually construct event-like object for handleFileUpload
                         handleFileUpload({ target: { files: e.dataTransfer.files, value: '' } } as any);
                     }
                 }}
            >
                <div style={{ marginBottom: '16px' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="var(--primary-color)" viewBox="0 0 16 16" style={{ filter: 'drop-shadow(0 0 8px rgba(0,240,255,0.4))' }}>
                        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
                        <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/>
                    </svg>
                </div>
                <h3 style={{ margin: '0 0 8px 0' }}>Upload to Vault</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.95rem' }}>
                    Drag & drop files here, or click to browse. Files are encrypted client-side.
                </p>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                    <input 
                        type="file" 
                        onChange={handleFileUpload} 
                        disabled={uploading} 
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                    />
                    <button className="btn btn-primary" style={{ pointerEvents: 'none' }}>
                        {uploading ? 'Encrypting & Uploading...' : 'Select File'}
                    </button>
                </div>
            </div>

            <div className="glass-panel">
                <div className="flex justify-between align-center" style={{ marginBottom: '24px' }}>
                    <h3 style={{ margin: 0 }}>My Encrypted Files</h3>
                    {loading && <span style={{ color: 'var(--primary-color)', fontSize: '0.9rem', animation: 'pulse 1.5s infinite' }}>Decrypting...</span>}
                </div>
                
                {files.length === 0 ? (
                    <div className="text-center" style={{ padding: '40px 20px', color: 'var(--text-secondary)' }}>
                        <p>No files in your vault yet. Upload one above!</p>
                    </div>
                ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {files.map(f => (
                            <li key={f.id} style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center',
                                padding: '16px', 
                                borderBottom: '1px solid var(--surface-border)',
                                transition: 'background var(--transition-fast)'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="var(--secondary-color)" viewBox="0 0 16 16">
                                        <path d="M4 0h5.293A1 1 0 0 1 10 .293L13.707 4a1 1 0 0 1 .293.707V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2m5.5 1.5v2a1 1 0 0 0 1 1h2z"/>
                                    </svg>
                                    <span style={{ fontWeight: 500 }}>{decryptedNames[f.id] || f.id}</span>
                                </div>
                                <button 
                                    onClick={() => handleDownload(f.id)} 
                                    disabled={loading} 
                                    className="btn btn-secondary"
                                    style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                                >
                                    Download
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            
            <style>{`
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }
            `}</style>
        </div>
    );
};
