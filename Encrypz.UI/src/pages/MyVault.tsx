import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './Vault.css';
import { 
    deriveKey,
    arrayBufferToBase64, 
    decryptData, 
    base64ToArrayBuffer, 
    uint8ArrayToString,
    encryptData
} from '../utils/crypto';
import { generateThumbnailBytes } from '../utils/media';

const API_BASE_URL = 'http://localhost:5207/api';

interface FileItem {
    id: string;
    encryptedFileName: string;
    folderId: string | null;
    fileSize?: number;
    uploadedAt?: string;
    encryptedThumbnail?: string | null;
    thumbnailIv?: string | null;
    thumbnailAuthTag?: string | null;
}

interface FolderItem {
    id: string;
    encryptedFolderName: string;
    parentFolderId: string | null;
}

type ViewMode = 'grid' | 'list';
type FilterType = 'All' | 'Photos' | 'Videos' | 'Documents';

export const MyVault = () => {
    const userId = sessionStorage.getItem('userId');
    const masterPassword = sessionStorage.getItem('masterPassword');
    const username = sessionStorage.getItem('username'); 

    const [files, setFiles] = useState<FileItem[]>([]);
    const [folders, setFolders] = useState<FolderItem[]>([]);
    const [decryptedNames, setDecryptedNames] = useState<Record<string, string>>({});
    const [decryptedThumbnails, setDecryptedThumbnails] = useState<Record<string, string>>({});
    
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [breadcrumbs, setBreadcrumbs] = useState<{id: string, name: string}[]>([]);
    
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [addMenuOpen, setAddMenuOpen] = useState(false);
    
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [activeFilter, setActiveFilter] = useState<FilterType>('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItem, setSelectedItem] = useState<{type: 'file'|'folder', id: string} | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const onUpload = () => triggerUpload();
        const onNewFolder = () => handleCreateFolder();
        
        document.addEventListener('trigger-upload', onUpload);
        document.addEventListener('trigger-new-folder', onNewFolder);
        return () => {
            document.removeEventListener('trigger-upload', onUpload);
            document.removeEventListener('trigger-new-folder', onNewFolder);
        };
    });

    useEffect(() => {
        if (userId && masterPassword && username) {
            fetchContents(currentFolderId);
        }
    }, [userId, currentFolderId]);

    const fetchContents = async (folderId: string | null) => {
        try {
            setLoading(true);
            setSelectedItem(null); // Clear selection on navigate
            const [filesRes, foldersRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/Files/user/${userId}${folderId ? `?folderId=${folderId}` : ''}`),
                axios.get(`${API_BASE_URL}/Folders/user/${userId}${folderId ? `?parentId=${folderId}` : ''}`)
            ]);

            setFiles(filesRes.data);
            setFolders(foldersRes.data);
            await decryptNames(filesRes.data, foldersRes.data);
        } catch (error) {
            console.error('Failed to fetch contents', error);
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

    const handleCreateFolder = async () => {
        const folderName = prompt('Enter folder name:');
        if (!folderName) return;
        
        if (!masterPassword || !username || !userId) return;

        setLoading(true);
        try {
            const key = await deriveKey(masterPassword, username);
            const folderNameBytes = new TextEncoder().encode(folderName);
            const { encryptedData, iv, authTag } = await encryptData(folderNameBytes, key);

            await axios.post(`${API_BASE_URL}/Folders`, {
                userId,
                parentFolderId: currentFolderId,
                encryptedFolderName: btoa(String.fromCharCode(...new Uint8Array(encryptedData))),
                initializationVector: btoa(String.fromCharCode(...iv)),
                authenticationTag: btoa(String.fromCharCode(...authTag))
            });

            fetchContents(currentFolderId);
        } catch (error) {
            alert('Failed to create folder.');
        } finally {
            setLoading(false);
        }
    };

    const handleFolderClick = (folderId: string) => {
        const folderName = decryptedNames[folderId] || 'Unknown Folder';
        setBreadcrumbs([...breadcrumbs, { id: folderId, name: folderName }]);
        setCurrentFolderId(folderId);
    };

    const handleBreadcrumbClick = (folderId: string | null, index: number) => {
        setBreadcrumbs(breadcrumbs.slice(0, index));
        setCurrentFolderId(folderId);
    };

    const handleDeleteFolder = async (folderId: string) => {
        if (!window.confirm("Are you sure you want to send this folder to the recycle bin?")) return;
        setLoading(true);
        try {
            await axios.delete(`${API_BASE_URL}/Folders/${folderId}`);
            setFolders(folders.filter(f => f.id !== folderId));
            setSelectedItem(null);
        } catch (error) {
            alert('Failed to delete folder.');
        } finally { setLoading(false); }
    };

    const handleDownload = async (fileId: string, filename: string) => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/Files/${fileId}/download`);
            const { encryptedData, initializationVector, authenticationTag } = response.data;
            
            if (!masterPassword || !username) throw new Error("Missing credentials");
            const key = await deriveKey(masterPassword, username);
            
            const payloadBytes = base64ToArrayBuffer(encryptedData);
            const ivBytes = base64ToArrayBuffer(initializationVector);
            const tagBytes = base64ToArrayBuffer(authenticationTag);
            
            const decryptedBytes = await decryptData(payloadBytes, ivBytes, tagBytes, key);
            
            const blob = new Blob([decryptedBytes], { type: 'application/octet-stream' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

        } catch (error) {
            console.error(error);
            alert('Failed to download or decrypt file.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteFile = async (fileId: string) => {
        if (!window.confirm("Are you sure you want to send this file to the recycle bin?")) return;
        setLoading(true);
        try {
            await axios.delete(`${API_BASE_URL}/Files/${fileId}`);
            setFiles(files.filter(f => f.id !== fileId));
            setSelectedItem(null);
        } catch (error) {
            alert('Failed to delete file.');
        } finally { setLoading(false); }
    };

    const triggerUpload = () => {
        fileInputRef.current?.click();
    };

    const handleVaultFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0) return;
        
        if (!userId || !masterPassword || !username) {
            alert('Authentication details missing. Please log in again.');
            return;
        }

        setUploading(true);
        try {
            const key = await deriveKey(masterPassword, username);
            const files = Array.from(event.target.files);

            for (const file of files) {
                const arrayBuffer = await file.arrayBuffer();
                const fileBytes = new Uint8Array(arrayBuffer);
                const { payload: encryptedData, iv, authTag } = await encryptData(fileBytes, key);

                const fileNameBytes = new TextEncoder().encode(file.name);
                const encryptedFileNameBytes = fileNameBytes;

                let thumbPayload = null, thumbIv = null, thumbTag = null;
                if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
                    try {
                        const thumbBytes = await generateThumbnailBytes(file);
                        if (thumbBytes) {
                            const thumbEncryption = await encryptData(thumbBytes, key);
                            thumbPayload = arrayBufferToBase64(new Uint8Array(thumbEncryption.payload));
                            thumbIv = arrayBufferToBase64(new Uint8Array(thumbEncryption.iv));
                            thumbTag = arrayBufferToBase64(new Uint8Array(thumbEncryption.authTag));
                        }
                    } catch (e) { console.error("Thumbnail generation failed for", file.name, e); }
                }

                await axios.post(`${API_BASE_URL}/Files`, {
                    userId,
                    folderId: currentFolderId,
                    fileSize: file.size,
                    encryptedFileName: arrayBufferToBase64(new Uint8Array(encryptedFileNameBytes)),
                    payload: arrayBufferToBase64(new Uint8Array(encryptedData)),
                    initializationVector: arrayBufferToBase64(new Uint8Array(iv)),
                    authenticationTag: arrayBufferToBase64(new Uint8Array(authTag)),
                    encryptedThumbnail: thumbPayload,
                    thumbnailIv: thumbIv,
                    thumbnailAuthTag: thumbTag
                });
            }
            fetchContents(currentFolderId);
        } catch (error) {
            console.error(error);
            alert('Failed to upload some files.');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    
    const formatBytes = (bytes: number, decimals = 2) => {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const getFileCategory = (filename: string) => {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return 'Photos';
        if (['mp4', 'webm', 'ogg', 'mov', 'avi'].includes(ext)) return 'Videos';
        if (['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx'].includes(ext)) return 'Documents';
        return 'Other';
    };

    const filteredFiles = files.filter(f => {
        const name = (decryptedNames[f.id] || '').toLowerCase();
        if (searchQuery && !name.includes(searchQuery.toLowerCase())) return false;
        
        if (activeFilter !== 'All') {
            const cat = getFileCategory(name);
            if (cat !== activeFilter) return false;
        }
        return true;
    });

    const filteredFolders = folders.filter(f => {
        if (activeFilter !== 'All') return false; // Hide folders if filtering by file type
        const name = (decryptedNames[f.id] || '').toLowerCase();
        if (searchQuery && !name.includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    return (
        <div className="vault-container animate-fade-in">
            {/* Main Content Area */}
            <div className="vault-main" style={{ paddingRight: selectedItem ? '336px' : '16px' }}>
                <div className="vault-header-sticky">
                    <div className="vault-header-top">
                        <div className="breadcrumbs" style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-color)' }}>
                            <span className={`breadcrumb-item ${breadcrumbs.length === 0 ? 'active' : ''}`} onClick={() => handleBreadcrumbClick(null, 0)}>My Vault</span>
                            {breadcrumbs.map((crumb, index) => (
                                <span key={crumb.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>/</span>
                                    <span className={`breadcrumb-item ${index === breadcrumbs.length - 1 ? 'active' : ''}`} 
                                          onClick={() => handleBreadcrumbClick(crumb.id, index + 1)}>
                                        {crumb.name}
                                    </span>
                                </span>
                            ))}
                        </div>

                        <div className="vault-header-actions">
                            <div style={{ position: 'relative' }}>
                                <button className="btn-add-pill" onClick={() => setAddMenuOpen(!addMenuOpen)}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg>
                                    Add
                                </button>
                                {addMenuOpen && (
                                    <div className="add-dropdown">
                                        <button className="add-dropdown-item" onClick={() => { setAddMenuOpen(false); triggerUpload(); }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/></svg>
                                            Upload Files
                                        </button>
                                        <button className="add-dropdown-item" onClick={() => { setAddMenuOpen(false); handleCreateFolder(); }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 6.5a.5.5 0 0 1 .5.5v1.5H10a.5.5 0 0 1 0 1H8.5V11a.5.5 0 0 1-1 0V9.5H6a.5.5 0 0 1 0-1h1.5V7a.5.5 0 0 1 .5-.5z"/><path d="M.54 3.87.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.826a2 2 0 0 1-1.991-1.819l-.637-7a1.99 1.99 0 0 1 .342-1.31zM2.19 4a1 1 0 0 0-.996 1.09l.637 7a1 1 0 0 0 .995.91h10.348a1 1 0 0 0 .995-.91l.637-7A1 1 0 0 0 13.81 4H2.19z"/></svg>
                                            New Folder
                                        </button>
                                    </div>
                                )}
                            </div>
                            
                            <div className="search-bar-wrapper" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '24px', padding: '6px 16px' }}>
                                <svg className="search-icon" style={{ color: 'var(--text-muted)' }} xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0"/></svg>
                                <input 
                                    type="text" 
                                    className="gallery-search-input" 
                                    placeholder="Search vault..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', marginLeft: '8px' }}
                                />
                            </div>
                            
                            <div className="view-toggles" style={{ background: 'transparent', border: 'none' }}>
                                <button className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')} style={{ background: viewMode === 'grid' ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: '4px' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5z"/></svg>
                                </button>
                                <button className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')} style={{ background: viewMode === 'list' ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: '4px' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5"/></svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="filter-chips">
                        {['All', 'Photos', 'Videos', 'Documents'].map(filter => (
                            <button 
                                key={filter} 
                                className={`filter-chip ${activeFilter === filter ? 'active' : ''}`}
                                onClick={() => setActiveFilter(filter as FilterType)}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>
                </div>


                {loading && <div style={{ textAlign: 'center', color: 'var(--primary)', padding: '24px' }}>Syncing vault...</div>}
                {uploading && <div style={{ textAlign: 'center', color: 'var(--success-color)', padding: '24px' }}>Encrypting and uploading files securely...</div>}

                {filteredFolders.length > 0 && (
                    <>
                        <h3 className="section-heading">Folders <span className="section-badge">{filteredFolders.length}</span></h3>
                        <div className="folders-grid">
                            {filteredFolders.map(f => (
                                <div 
                                    key={f.id} 
                                    className={`folder-card ${selectedItem?.type === 'folder' && selectedItem.id === f.id ? 'selected' : ''}`}
                                    onClick={() => setSelectedItem({type: 'folder', id: f.id})}
                                    onDoubleClick={() => handleFolderClick(f.id)}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="var(--primary)" viewBox="0 0 16 16"><path d="M.54 3.87.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.826a2 2 0 0 1-1.991-1.819l-.637-7a1.99 1.99 0 0 1 .342-1.31zM2.19 4a1 1 0 0 0-.996 1.09l.637 7a1 1 0 0 0 .995.91h10.348a1 1 0 0 0 .995-.91l.637-7A1 1 0 0 0 13.81 4H2.19zm4.69-1.707A1 1 0 0 0 6.172 2H2.5a1 1 0 0 0-1 .981l.006.139C1.72 3.042 1.95 3 2.19 3h5.396l-.707-.707z"/></svg>
                                    <span style={{ fontWeight: 500, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {decryptedNames[f.id] || 'Encrypted Folder'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {filteredFiles.length > 0 && (
                    <>
                        <h3 className="section-heading">Files <span className="section-badge">{filteredFiles.length}</span></h3>
                        
                        {viewMode === 'grid' ? (
                            <div className="gallery-grid">
                                {filteredFiles.map(f => {
                                    const filename = decryptedNames[f.id] || 'Unknown';
                                    const category = getFileCategory(filename);
                                    return (
                                        <div 
                                            key={f.id} 
                                            className="gallery-item"
                                            onClick={() => setSelectedItem({type: 'file', id: f.id})}
                                            style={{ borderColor: selectedItem?.id === f.id ? 'var(--primary)' : '' }}
                                        >
                                            <div className="gallery-item-icon" style={{ overflow: 'hidden', width: '100%', height: '100%' }}>
                                                {decryptedThumbnails[f.id] ? (
                                                    <img src={decryptedThumbnails[f.id]} alt="thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : category === 'Photos' ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="var(--secondary-color)" viewBox="0 0 16 16"><path d="M4 0h5.293A1 1 0 0 1 10 .293L13.707 4a1 1 0 0 1 .293.707V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2m5.5 1.5v2a1 1 0 0 0 1 1h2z"/><path d="M10.5 5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/><path d="M4.5 10.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-2z"/><path d="M8.5 10.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-2z"/></svg>
                                                ) : category === 'Videos' ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="#a855f7" viewBox="0 0 16 16"><path d="M0 12V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm6.79-6.907A.5.5 0 0 0 6 5.5v5a.5.5 0 0 0 .79.407l3.5-2.5a.5.5 0 0 0 0-.814l-3.5-2.5z"/></svg>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="var(--text-muted)" viewBox="0 0 16 16"><path d="M4 0h5.293A1 1 0 0 1 10 .293L13.707 4a1 1 0 0 1 .293.707V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2m5.5 1.5v2a1 1 0 0 0 1 1h2z"/></svg>
                                                )}
                                            </div>
                                            <div className="gallery-item-title">{filename}</div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <table className="list-view-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Size</th>
                                        <th>Date Uploaded</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredFiles.map(f => {
                                        const filename = decryptedNames[f.id] || 'Unknown';
                                        return (
                                            <tr key={f.id} 
                                                className={`list-view-row ${selectedItem?.id === f.id ? 'selected' : ''}`}
                                                onClick={() => setSelectedItem({type: 'file', id: f.id})}
                                            >
                                                <td className="list-view-cell list-view-cell-name">
                                                    <div className="list-view-icon">
                                                        {decryptedThumbnails[f.id] ? (
                                                            <img src={decryptedThumbnails[f.id]} alt="thumb" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} />
                                                        ) : (
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="var(--text-muted)" viewBox="0 0 16 16"><path d="M4 0h5.293A1 1 0 0 1 10 .293L13.707 4a1 1 0 0 1 .293.707V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2m5.5 1.5v2a1 1 0 0 0 1 1h2z"/></svg>
                                                        )}
                                                    </div>
                                                    {filename}
                                                </td>
                                                <td className="list-view-cell" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                    {f.fileSize !== undefined ? formatBytes(f.fileSize) : 'Unknown'}
                                                </td>
                                                <td className="list-view-cell" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                    {f.uploadedAt ? formatDate(f.uploadedAt) : 'Unknown'}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </>
                )}
            </div>

            {/* Side Panel for Details */}
            <div className={`side-panel ${selectedItem ? 'open' : ''}`}>
                <div className="side-panel-header">
                    <span style={{ fontWeight: 600 }}>Details</span>
                    <button className="side-panel-close" onClick={() => setSelectedItem(null)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/></svg>
                    </button>
                </div>
                
                {selectedItem && (
                    <div className="side-panel-content">
                        {selectedItem.type === 'file' && (
                            <>
                                <div className="panel-preview">
                                    {decryptedThumbnails[selectedItem.id] ? (
                                        <img src={decryptedThumbnails[selectedItem.id]} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="var(--text-muted)" viewBox="0 0 16 16"><path d="M4 0h5.293A1 1 0 0 1 10 .293L13.707 4a1 1 0 0 1 .293.707V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2m5.5 1.5v2a1 1 0 0 0 1 1h2z"/></svg>
                                    )}
                                </div>
                                <div className="panel-metadata-block">
                                    <div className="metadata-item">
                                        <span className="metadata-label">Name</span>
                                        <span className="metadata-value">{decryptedNames[selectedItem.id] || 'Unknown'}</span>
                                    </div>
                                    <div className="metadata-item">
                                        <span className="metadata-label">Type</span>
                                        <span className="metadata-value">{getFileCategory(decryptedNames[selectedItem.id] || '')}</span>
                                    </div>
                                    <div className="metadata-item">
                                        <span className="metadata-label">Size</span>
                                        <span className="metadata-value">{
                                            files.find(f => f.id === selectedItem.id)?.fileSize !== undefined 
                                            ? formatBytes(files.find(f => f.id === selectedItem.id)!.fileSize!) 
                                            : 'Unknown'
                                        }</span>
                                    </div>
                                    <div className="metadata-item">
                                        <span className="metadata-label">Date Uploaded</span>
                                        <span className="metadata-value">{
                                            files.find(f => f.id === selectedItem.id)?.uploadedAt 
                                            ? formatDate(files.find(f => f.id === selectedItem.id)!.uploadedAt!) 
                                            : 'Unknown'
                                        }</span>
                                    </div>
                                    <div className="metadata-item">
                                        <span className="metadata-label">Security</span>
                                        <span className="metadata-value" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success-color)' }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/></svg>
                                            AES-256-GCM Encrypted
                                        </span>
                                    </div>
                                </div>
                                <div className="panel-actions" style={{ flexDirection: 'row', gap: '8px', padding: '16px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                    <button 
                                        className="btn-minimal" 
                                        onClick={() => handleDownload(selectedItem.id, decryptedNames[selectedItem.id] || 'Unknown')}
                                        title="Download"
                                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z"/></svg>
                                        <span style={{ fontSize: '0.85rem' }}>Download</span>
                                    </button>
                                    <button 
                                        className="btn-minimal btn-minimal-danger" 
                                        onClick={() => handleDeleteFile(selectedItem.id)}
                                        title="Delete"
                                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5M11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47M8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5"/></svg>
                                        <span style={{ fontSize: '0.85rem' }}>Delete</span>
                                    </button>
                                </div>
                            </>
                        )}
                        {selectedItem.type === 'folder' && (
                            <>
                                <div className="panel-preview" style={{ border: 'none', background: 'transparent' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" fill="var(--primary)" viewBox="0 0 16 16"><path d="M.54 3.87.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.826a2 2 0 0 1-1.991-1.819l-.637-7a1.99 1.99 0 0 1 .342-1.31zM2.19 4a1 1 0 0 0-.996 1.09l.637 7a1 1 0 0 0 .995.91h10.348a1 1 0 0 0 .995-.91l.637-7A1 1 0 0 0 13.81 4H2.19zm4.69-1.707A1 1 0 0 0 6.172 2H2.5a1 1 0 0 0-1 .981l.006.139C1.72 3.042 1.95 3 2.19 3h5.396l-.707-.707z"/></svg>
                                </div>
                                <div className="panel-metadata-block">
                                    <div className="metadata-item">
                                        <span className="metadata-label">Name</span>
                                        <span className="metadata-value">{decryptedNames[selectedItem.id] || 'Unknown'}</span>
                                    </div>
                                </div>
                                <div className="panel-actions">
                                    <button className="panel-btn panel-btn-primary" onClick={() => handleFolderClick(selectedItem.id)}>
                                        Open Folder
                                    </button>
                                    <button className="panel-btn panel-btn-danger" onClick={() => handleDeleteFolder(selectedItem.id)}>
                                        Move to Bin
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Hidden Input & FAB */}
            <input 
                type="file" 
                multiple 
                ref={fileInputRef}
                style={{ display: 'none' }} 
                onChange={handleVaultFileUpload} 
            />
            

        </div>
    );
};
