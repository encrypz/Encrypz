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
    folderId: string | null;
    encryptedThumbnail?: string | null;
    thumbnailIv?: string | null;
    thumbnailAuthTag?: string | null;
}

interface FolderItem {
    id: string;
    encryptedFolderName: string;
    parentFolderId: string | null;
}

export const RecycleBin = () => {
    
    const userId = sessionStorage.getItem('userId');
    const masterPassword = sessionStorage.getItem('masterPassword');
    const username = sessionStorage.getItem('username'); 

    const [files, setFiles] = useState<FileItem[]>([]);
    const [folders, setFolders] = useState<FolderItem[]>([]);
    const [decryptedNames, setDecryptedNames] = useState<Record<string, string>>({});
    const [decryptedThumbnails, setDecryptedThumbnails] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    

    useEffect(() => {
        if (userId && masterPassword && username) {
            fetchContents();
        }
    }, [userId]);



    const fetchContents = async () => {
        try {
            setLoading(true);
            const [filesRes, foldersRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/Files/deleted/${userId}`),
                axios.get(`${API_BASE_URL}/Folders/deleted/${userId}`)
            ]);

            setFiles(filesRes.data);
            setFolders(foldersRes.data);
            await decryptNames(filesRes.data, foldersRes.data);
        } catch (error) {
            console.error('Failed to fetch deleted contents', error);
        } finally {
            setLoading(false);
        }
    };

    const decryptNames = async (fileList: FileItem[], folderList: FolderItem[]) => {
        if (!masterPassword || !username) return;
        const names: Record<string, string> = {};
        const thumbnails: Record<string, string> = {};
        const key = await deriveKey(masterPassword, username);

        for (const file of fileList) {
            try {
                const fileNameBytes = base64ToArrayBuffer(file.encryptedFileName);
                names[file.id] = uint8ArrayToString(fileNameBytes);
            } catch {
                names[file.id] = `Encrypted File (${file.id.substring(0, 8)})`;
            }

            if (file.encryptedThumbnail && file.thumbnailIv && file.thumbnailAuthTag) {
                try {
                    const thumbPayload = base64ToArrayBuffer(file.encryptedThumbnail);
                    const thumbIv = base64ToArrayBuffer(file.thumbnailIv);
                    const thumbTag = base64ToArrayBuffer(file.thumbnailAuthTag);
                    const decryptedThumbBytes = await decryptData(thumbPayload, thumbIv, thumbTag, key);
                    const blob = new Blob([decryptedThumbBytes], { type: 'image/jpeg' });
                    thumbnails[file.id] = URL.createObjectURL(blob);
                } catch (e) {}
            }
        }
        setDecryptedThumbnails(thumbnails);

        for (const folder of folderList) {
            try {
                const payloadBytes = base64ToArrayBuffer(folder.encryptedFolderName);
                const ivBytes = base64ToArrayBuffer((folder as any).initializationVector);
                const tagBytes = base64ToArrayBuffer((folder as any).authenticationTag);
                const decryptedBytes = await decryptData(payloadBytes, ivBytes, tagBytes, key);
                names[folder.id] = uint8ArrayToString(decryptedBytes);
            } catch {
                names[folder.id] = `Encrypted Folder (${folder.id.substring(0, 8)})`;
            }
        }
        setDecryptedNames(names);
    };

    const handleRestoreFolder = async (folderId: string) => {
        setLoading(true);
        try {
            await axios.post(`${API_BASE_URL}/Folders/${folderId}/restore`);
            setFolders(folders.filter(f => f.id !== folderId));
        } catch (error) {
            alert('Failed to restore folder.');
        } finally { setLoading(false); }
    };

    const handlePermanentDeleteFolder = async (folderId: string) => {
        if (!window.confirm("Delete folder PERMANENTLY? This cannot be undone.")) return;
        setLoading(true);
        try {
            await axios.delete(`${API_BASE_URL}/Folders/${folderId}/permanent`);
            setFolders(folders.filter(f => f.id !== folderId));
        } catch (error) {
            alert('Failed to delete folder permanently.');
        } finally { setLoading(false); }
    };

    const handleRestoreFile = async (fileId: string) => {
        setLoading(true);
        try {
            await axios.post(`${API_BASE_URL}/Files/${fileId}/restore`);
            setFiles(files.filter(f => f.id !== fileId));
        } catch (error) {
            alert('Failed to restore file.');
        } finally { setLoading(false); }
    };

    const handlePermanentDeleteFile = async (fileId: string) => {
        if (!window.confirm("Delete file PERMANENTLY? This cannot be undone.")) return;
        setLoading(true);
        try {
            await axios.delete(`${API_BASE_URL}/Files/${fileId}/permanent`);
            setFiles(files.filter(f => f.id !== fileId));
        } catch (error) {
            alert('Failed to delete file permanently.');
        } finally { setLoading(false); }
    };



    const getFileCategory = (filename: string) => {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return 'Photos';
        if (['mp4', 'webm', 'ogg', 'mov', 'avi'].includes(ext)) return 'Videos';
        if (['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx'].includes(ext)) return 'Documents';
        return 'Other';
    };

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
            <div className="vault-header-sticky">
                <div className="flex justify-between align-center">
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="var(--primary)" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                        Recycle Bin
                    </h2>
                    {loading && <span style={{ color: 'var(--primary)', fontSize: '0.85rem', animation: 'pulse 1.5s infinite' }}>Loading...</span>}
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '8px' }}>Items here will be permanently deleted automatically after 1 hour.</p>
            </div>
            
            {files.length === 0 && folders.length === 0 ? (
                <div className="text-center" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="rgba(255,255,255,0.1)" viewBox="0 0 16 16" style={{ margin: '0 auto 16px auto' }}>
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                        <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                    </svg>
                    <p style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Recycle bin is empty.</p>
                </div>
            ) : (
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
                    <div className="gallery-grid">
                        {folders.map(f => (
                            <div key={f.id} className="gallery-item" style={{ opacity: 0.8 }}>
                                <div className="gallery-item-icon">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="var(--primary)" viewBox="0 0 16 16">
                                        <path d="M.54 3.87.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.826a2 2 0 0 1-1.991-1.819l-.637-7a1.99 1.99 0 0 1 .342-1.31zM2.19 4a1 1 0 0 0-.996 1.09l.637 7a1 1 0 0 0 .995.91h10.348a1 1 0 0 0 .995-.91l.637-7A1 1 0 0 0 13.81 4H2.19zm4.69-1.707A1 1 0 0 0 6.172 2H2.5a1 1 0 0 0-1 .981l.006.139C1.72 3.042 1.95 3 2.19 3h5.396l-.707-.707z"/>
                                    </svg>
                                </div>
                                <div className="gallery-item-title"><del>{decryptedNames[f.id] || f.id}</del></div>
                                <div className="gallery-item-overlay">
                                    <button onClick={(e) => { e.stopPropagation(); handleRestoreFolder(f.id); }} className="gallery-action-btn">Restore</button>
                                    <button onClick={(e) => { e.stopPropagation(); handlePermanentDeleteFolder(f.id); }} className="gallery-action-btn danger">Delete Forever</button>
                                </div>
                            </div>
                        ))}
                        {files.map(f => (
                            <div key={f.id} className="gallery-item" style={{ opacity: 0.8 }}>
                                <div className="gallery-item-icon" style={{ overflow: 'hidden' }}>
                                    {decryptedThumbnails[f.id] ? (
                                        <img src={decryptedThumbnails[f.id]} alt="thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : getFileCategory(decryptedNames[f.id] || '') === 'Photos' ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="var(--secondary-color)" viewBox="0 0 16 16"><path d="M4 0h5.293A1 1 0 0 1 10 .293L13.707 4a1 1 0 0 1 .293.707V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2m5.5 1.5v2a1 1 0 0 0 1 1h2z"/><path d="M10.5 5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/><path d="M4.5 10.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-2z"/><path d="M8.5 10.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-2z"/></svg>
                                    ) : getFileCategory(decryptedNames[f.id] || '') === 'Videos' ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="#a855f7" viewBox="0 0 16 16"><path d="M0 12V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm6.79-6.907A.5.5 0 0 0 6 5.5v5a.5.5 0 0 0 .79.407l3.5-2.5a.5.5 0 0 0 0-.814l-3.5-2.5z"/></svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="var(--text-muted)" viewBox="0 0 16 16"><path d="M4 0h5.293A1 1 0 0 1 10 .293L13.707 4a1 1 0 0 1 .293.707V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2m5.5 1.5v2a1 1 0 0 0 1 1h2z"/></svg>
                                    )}
                                </div>
                                <div className="gallery-item-title"><del>{decryptedNames[f.id] || f.id}</del></div>
                                <div className="gallery-item-overlay">
                                    <button onClick={(e) => { e.stopPropagation(); handleRestoreFile(f.id); }} className="gallery-action-btn">Restore</button>
                                    <button onClick={(e) => { e.stopPropagation(); handlePermanentDeleteFile(f.id); }} className="gallery-action-btn danger">Delete Forever</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
