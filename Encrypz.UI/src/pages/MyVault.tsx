import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    deriveKey, 
    decryptData, 
    base64ToArrayBuffer, 
    uint8ArrayToString 
} from '../utils/crypto';

const API_BASE_URL = 'http://localhost:5207/api';

interface FileItem {
    id: string;
    encryptedFileName: string;
}

export const MyVault = () => {
    const userId = sessionStorage.getItem('userId');
    const masterPassword = sessionStorage.getItem('masterPassword');
    const username = sessionStorage.getItem('username'); // Used as salt

    const [files, setFiles] = useState<FileItem[]>([]);
    const [decryptedNames, setDecryptedNames] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [previewData, setPreviewData] = useState<string | null>(null);
    const [previewType, setPreviewType] = useState<string | null>(null);
    const [previewName, setPreviewName] = useState<string | null>(null);

    useEffect(() => {
        if (userId && masterPassword && username) {
            fetchFiles();
        }
    }, [userId]);

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
        
        const names: Record<string, string> = {};

        for (const file of fileList) {
            try {
                const fileNameBytes = base64ToArrayBuffer(file.encryptedFileName);
                const fileName = uint8ArrayToString(fileNameBytes);
                names[file.id] = fileName;
            } catch {
                names[file.id] = `Encrypted File (${file.id.substring(0, 8)})`;
            }
        }
        setDecryptedNames(names);
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

            const decryptedBytes = await decryptData(payloadBytes, ivBytes, tagBytes, key);
            
            const fileNameBytes = base64ToArrayBuffer(data.encryptedFileName);
            const fileName = uint8ArrayToString(fileNameBytes);

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
            alert('Decryption or download failed.');
        } finally {
            setLoading(false);
        }
    };

    const isPreviewable = (filename: string) => {
        const ext = filename.split('.').pop()?.toLowerCase();
        return ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif' || ext === 'pdf' || ext === 'txt';
    };

    const handlePreview = async (fileId: string) => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/Files/${fileId}`);
            const data = response.data;

            const key = await deriveKey(masterPassword!, username!);

            const payloadBytes = base64ToArrayBuffer(data.payload);
            const ivBytes = base64ToArrayBuffer(data.initializationVector);
            const tagBytes = base64ToArrayBuffer(data.authenticationTag);

            const decryptedBytes = await decryptData(payloadBytes, ivBytes, tagBytes, key);
            
            const fileNameBytes = base64ToArrayBuffer(data.encryptedFileName);
            const fileName = uint8ArrayToString(fileNameBytes);

            const ext = fileName.split('.').pop()?.toLowerCase();
            let mimeType = 'application/octet-stream';
            let type = 'unknown';

            if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif') {
                mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
                type = 'image';
            } else if (ext === 'pdf') {
                mimeType = 'application/pdf';
                type = 'pdf';
            } else if (ext === 'txt') {
                mimeType = 'text/plain';
                type = 'text';
            }

            const blob = new Blob([decryptedBytes], { type: mimeType });
            const url = window.URL.createObjectURL(blob);
            
            setPreviewData(url);
            setPreviewType(type);
            setPreviewName(fileName);

        } catch (error) {
            console.error('Preview failed', error);
            alert('Decryption or preview failed.');
        } finally {
            setLoading(false);
        }
    };

    const closePreview = () => {
        if (previewData) {
            window.URL.revokeObjectURL(previewData);
        }
        setPreviewData(null);
        setPreviewType(null);
        setPreviewName(null);
    };

    return (
        <div className="glass-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="flex justify-between align-center" style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--surface-border)' }}>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="var(--primary-color)" viewBox="0 0 16 16">
                        <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
                    </svg>
                    My Encrypted Vault
                </h2>
                {loading && <span style={{ color: 'var(--primary-color)', fontSize: '0.95rem', animation: 'pulse 1.5s infinite' }}>Decrypting...</span>}
            </div>
            
            {files.length === 0 ? (
                <div className="text-center" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="rgba(255,255,255,0.1)" viewBox="0 0 16 16" style={{ margin: '0 auto 16px auto' }}>
                        <path d="M4 0h5.293A1 1 0 0 1 10 .293L13.707 4a1 1 0 0 1 .293.707V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2m5.5 1.5v2a1 1 0 0 0 1 1h2z"/>
                    </svg>
                    <p style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Your vault is empty.</p>
                    <p>Go to the Upload page to secure your first file.</p>
                </div>
            ) : (
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {files.map(f => (
                            <li key={f.id} className="file-item">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="var(--secondary-color)" viewBox="0 0 16 16">
                                            <path d="M4 0h5.293A1 1 0 0 1 10 .293L13.707 4a1 1 0 0 1 .293.707V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2m5.5 1.5v2a1 1 0 0 0 1 1h2z"/>
                                        </svg>
                                    </div>
                                    <span style={{ fontWeight: 500, fontSize: '1.1rem' }}>{decryptedNames[f.id] || f.id}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    {isPreviewable(decryptedNames[f.id] || '') && (
                                        <button 
                                            onClick={() => handlePreview(f.id)} 
                                            disabled={loading} 
                                            className="btn btn-secondary"
                                            style={{ padding: '8px 16px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                                <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>
                                                <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
                                            </svg>
                                            Preview
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => handleDownload(f.id)} 
                                        disabled={loading} 
                                        className="btn btn-secondary"
                                        style={{ padding: '8px 16px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                            <path d="M8 3a.5.5 0 0 1 .5.5v5.793l2.146-2.147a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 1 1 .708-.708L7.5 9.293V3.5A.5.5 0 0 1 8 3z"/>
                                            <path d="M2 12.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-1z"/>
                                        </svg>
                                        Download
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            
            {/* Preview Modal */}
            {previewData && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.85)', zIndex: 9999,
                    display: 'flex', flexDirection: 'column',
                    backdropFilter: 'blur(8px)', animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <h3 style={{ margin: 0, color: 'white' }}>{previewName}</h3>
                        <button onClick={closePreview} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '8px' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854z"/>
                            </svg>
                        </button>
                    </div>
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', overflow: 'hidden' }}>
                        {previewType === 'image' && (
                            <img src={previewData} alt={previewName!} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '4px' }} />
                        )}
                        {previewType === 'pdf' && (
                            <iframe src={previewData} style={{ width: '100%', height: '100%', border: 'none', borderRadius: '4px', background: 'white' }} title="PDF Preview" />
                        )}
                        {previewType === 'text' && (
                            <iframe src={previewData} style={{ width: '100%', height: '100%', border: 'none', borderRadius: '4px', background: 'white' }} title="Text Preview" />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
