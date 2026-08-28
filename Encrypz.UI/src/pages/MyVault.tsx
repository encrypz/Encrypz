import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    deriveKey, 
    decryptData, 
    encryptData,
    base64ToArrayBuffer, 
    arrayBufferToBase64,
    uint8ArrayToString,
    stringToUint8Array
} from '../utils/crypto';

const API_BASE_URL = 'http://localhost:5207/api';

interface FileItem {
    id: string;
    encryptedFileName: string;
    folderId: string | null;
}

interface FolderItem {
    id: string;
    encryptedFolderName: string;
    parentFolderId: string | null;
}

export const MyVault = () => {
    const userId = sessionStorage.getItem('userId');
    const masterPassword = sessionStorage.getItem('masterPassword');
    const username = sessionStorage.getItem('username'); // Used as salt

    const [files, setFiles] = useState<FileItem[]>([]);
    const [folders, setFolders] = useState<FolderItem[]>([]);
    const [decryptedNames, setDecryptedNames] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    
    // UI State
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<'All' | 'Photos' | 'Videos' | 'Documents'>('All');
    
    // Navigation State
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [breadcrumbs, setBreadcrumbs] = useState<{id: string | null, name: string}[]>([{id: null, name: 'My Vault'}]);

    // Modal State
    const [previewData, setPreviewData] = useState<string | null>(null);
    const [previewType, setPreviewType] = useState<string | null>(null);
    const [previewName, setPreviewName] = useState<string | null>(null);
    const [showNewFolderModal, setShowNewFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    useEffect(() => {
        if (userId && masterPassword && username) {
            fetchContents();
        }
    }, [userId, currentFolderId]);

    useEffect(() => {
        const handleClickOutside = () => setActiveDropdown(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const fetchContents = async () => {
        try {
            setLoading(true);
            const folderParam = currentFolderId ? `?folderId=${currentFolderId}` : '';
            const parentFolderParam = currentFolderId ? `?parentId=${currentFolderId}` : '';

            const [filesRes, foldersRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/Files/user/${userId}${folderParam}`),
                axios.get(`${API_BASE_URL}/Folders/user/${userId}${parentFolderParam}`)
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

        // Decrypt files
        for (const file of fileList) {
            try {
                const fileNameBytes = base64ToArrayBuffer(file.encryptedFileName);
                const fileName = uint8ArrayToString(fileNameBytes);
                names[file.id] = fileName;
            } catch {
                names[file.id] = `Encrypted File (${file.id.substring(0, 8)})`;
            }
        }

        // Decrypt folders
        try {
            const key = await deriveKey(masterPassword, username);
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
        } catch (error) {
            console.error("Folder decryption failed", error);
        }

        setDecryptedNames(names);
    };

    const handleCreateFolder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFolderName.trim() || !masterPassword || !username) return;

        setLoading(true);
        try {
            const key = await deriveKey(masterPassword, username);
            const nameBytes = stringToUint8Array(newFolderName.trim());
            const { payload, iv, authTag } = await encryptData(nameBytes, key);

            await axios.post(`${API_BASE_URL}/Folders`, {
                userId,
                parentFolderId: currentFolderId,
                encryptedFolderName: arrayBufferToBase64(payload),
                initializationVector: arrayBufferToBase64(iv),
                authenticationTag: arrayBufferToBase64(authTag)
            });

            setShowNewFolderModal(false);
            setNewFolderName('');
            fetchContents();
        } catch (error) {
            console.error('Failed to create folder', error);
            alert('Failed to create folder.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteFolder = async (folderId: string) => {
        if (!window.confirm("Are you sure you want to delete this folder and ALL its contents?")) return;
        setLoading(true);
        try {
            await axios.delete(`${API_BASE_URL}/Folders/${folderId}`);
            setFolders(folders.filter(f => f.id !== folderId));
        } catch (error) {
            console.error('Delete folder failed', error);
            alert('Failed to delete folder.');
        } finally {
            setLoading(false);
        }
    };

    // ... handleDownload, handleDelete, handlePreview remain the same, just keeping them concise ...
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
            alert('Decryption or download failed.');
        } finally { setLoading(false); }
    };

    const handleDelete = async (fileId: string) => {
        if (!window.confirm("Are you sure you want to permanently delete this file?")) return;
        setLoading(true);
        try {
            await axios.delete(`${API_BASE_URL}/Files/${fileId}`);
            setFiles(files.filter(f => f.id !== fileId));
        } catch (error) {
            alert('Failed to delete file.');
        } finally { setLoading(false); }
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
            alert('Preview failed.');
        } finally { setLoading(false); }
    };

    const closePreview = () => {
        if (previewData) window.URL.revokeObjectURL(previewData);
        setPreviewData(null);
        setPreviewType(null);
        setPreviewName(null);
    };

    const toggleDropdown = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setActiveDropdown(activeDropdown === id ? null : id);
    };

    const navigateToFolder = (folderId: string, folderName: string) => {
        setCurrentFolderId(folderId);
        setBreadcrumbs([...breadcrumbs, { id: folderId, name: folderName }]);
        setSearchQuery('');
    };

    const navigateToBreadcrumb = (index: number) => {
        const crumb = breadcrumbs[index];
        setCurrentFolderId(crumb.id);
        setBreadcrumbs(breadcrumbs.slice(0, index + 1));
        setSearchQuery('');
    };

    const getFileCategory = (filename: string) => {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return 'Photos';
        if (['mp4', 'webm', 'ogg', 'mov', 'avi'].includes(ext)) return 'Videos';
        if (['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx'].includes(ext)) return 'Documents';
        return 'Other';
    };

    const filteredFiles = files.filter(f => {
        const name = decryptedNames[f.id] || f.id;
        const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
        const category = getFileCategory(name);
        const matchesCategory = selectedCategory === 'All' || category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const filteredFolders = folders.filter(f => {
        const name = decryptedNames[f.id] || f.id;
        return name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    return (
        <div className="glass-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
            {/* Header / Breadcrumbs */}
            <div className="flex justify-between align-center" style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--surface-border)', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {breadcrumbs.map((crumb, index) => (
                        <span key={crumb.id || 'root'} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span 
                                onClick={() => navigateToBreadcrumb(index)}
                                style={{ 
                                    cursor: 'pointer', 
                                    color: index === breadcrumbs.length - 1 ? 'var(--primary-color)' : 'var(--text-secondary)',
                                    fontWeight: index === breadcrumbs.length - 1 ? 600 : 400
                                }}
                            >
                                {crumb.name}
                            </span>
                            {index < breadcrumbs.length - 1 && <span style={{ color: 'var(--text-secondary)' }}>/</span>}
                        </span>
                    ))}
                    {loading && <span style={{ marginLeft: '12px', color: 'var(--primary-color)', fontSize: '0.85rem', animation: 'pulse 1.5s infinite' }}>Loading...</span>}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: '1', justifyContent: 'flex-end' }}>
                    <div className="search-container" style={{ maxWidth: '200px' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="search-icon" viewBox="0 0 16 16">
                            <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                        </svg>
                        <input 
                            type="text" 
                            className="search-input" 
                            placeholder="Find..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    
                    <button onClick={() => setShowNewFolderModal(true)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.9rem' }}>
                        + New Folder
                    </button>

                    <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)', padding: '4px' }}>
                        <button onClick={() => setViewMode('list')} style={{ background: viewMode === 'list' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', borderRadius: '4px', padding: '6px 12px', color: viewMode === 'list' ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path fillRule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"/>
                            </svg>
                        </button>
                        <button onClick={() => setViewMode('grid')} style={{ background: viewMode === 'grid' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', borderRadius: '4px', padding: '6px 12px', color: viewMode === 'grid' ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zM2.5 2a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm6.5.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zM1 10.5A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm6.5.5A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3z"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Categories */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px' }}>
                {['All', 'Photos', 'Videos', 'Documents'].map(cat => (
                    <button 
                        key={cat} 
                        onClick={() => setSelectedCategory(cat as any)}
                        style={{
                            background: selectedCategory === cat ? 'var(--primary-color)' : 'rgba(255,255,255,0.05)',
                            color: selectedCategory === cat ? '#fff' : 'var(--text-primary)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '100px', padding: '6px 16px', cursor: 'pointer', transition: 'all 0.2s',
                            fontWeight: 500
                        }}
                    >
                        {cat}
                    </button>
                ))}
            </div>
            
            {filteredFiles.length === 0 && filteredFolders.length === 0 ? (
                <div className="text-center" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="rgba(255,255,255,0.1)" viewBox="0 0 16 16" style={{ margin: '0 auto 16px auto' }}>
                        <path d="M4 0h5.293A1 1 0 0 1 10 .293L13.707 4a1 1 0 0 1 .293.707V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2m5.5 1.5v2a1 1 0 0 0 1 1h2z"/>
                    </svg>
                    <p style={{ fontSize: '1.2rem', marginBottom: '8px' }}>This folder is empty.</p>
                </div>
            ) : (
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
                    {viewMode === 'list' ? (
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {/* Render Folders First */}
                            {filteredFolders.map(f => (
                                <li key={f.id} className="file-item" onDoubleClick={() => navigateToFolder(f.id, decryptedNames[f.id] || 'Folder')}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, cursor: 'pointer' }} onClick={() => navigateToFolder(f.id, decryptedNames[f.id] || 'Folder')}>
                                        <div style={{ background: 'rgba(var(--primary-color-rgb),0.15)', padding: '12px', borderRadius: '8px' }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="var(--primary-color)" viewBox="0 0 16 16">
                                                <path d="M.54 3.87.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.826a2 2 0 0 1-1.991-1.819l-.637-7a1.99 1.99 0 0 1 .342-1.31zM2.19 4a1 1 0 0 0-.996 1.09l.637 7a1 1 0 0 0 .995.91h10.348a1 1 0 0 0 .995-.91l.637-7A1 1 0 0 0 13.81 4H2.19zm4.69-1.707A1 1 0 0 0 6.172 2H2.5a1 1 0 0 0-1 .981l.006.139C1.72 3.042 1.95 3 2.19 3h5.396l-.707-.707z"/>
                                            </svg>
                                        </div>
                                        <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{decryptedNames[f.id] || f.id}</span>
                                    </div>
                                    <div className="dropdown-container">
                                        <button onClick={(e) => toggleDropdown(e, f.id)} className="btn btn-secondary" style={{ padding: '8px', background: 'transparent', border: 'none', color: 'var(--text-secondary)' }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/></svg>
                                        </button>
                                        {activeDropdown === f.id && (
                                            <div className="dropdown-menu">
                                                <button onClick={() => { handleDeleteFolder(f.id); setActiveDropdown(null); }} disabled={loading} className="dropdown-item danger">
                                                    Delete Folder
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </li>
                            ))}
                            {/* Render Files */}
                            {filteredFiles.map(f => (
                                <li key={f.id} className="file-item">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="var(--secondary-color)" viewBox="0 0 16 16">
                                                <path d="M4 0h5.293A1 1 0 0 1 10 .293L13.707 4a1 1 0 0 1 .293.707V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2m5.5 1.5v2a1 1 0 0 0 1 1h2z"/>
                                            </svg>
                                        </div>
                                        <span style={{ fontWeight: 500, fontSize: '1.1rem' }}>{decryptedNames[f.id] || f.id}</span>
                                    </div>
                                    <div className="dropdown-container">
                                        <button onClick={(e) => toggleDropdown(e, f.id)} className="btn btn-secondary" style={{ padding: '8px', background: 'transparent', border: 'none', color: 'var(--text-secondary)' }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/></svg>
                                        </button>
                                        {activeDropdown === f.id && (
                                            <div className="dropdown-menu">
                                                {isPreviewable(decryptedNames[f.id] || '') && (
                                                    <button onClick={() => { handlePreview(f.id); setActiveDropdown(null); }} disabled={loading} className="dropdown-item">Preview</button>
                                                )}
                                                <button onClick={() => { handleDownload(f.id); setActiveDropdown(null); }} disabled={loading} className="dropdown-item">Download</button>
                                                <button onClick={() => { handleDelete(f.id); setActiveDropdown(null); }} disabled={loading} className="dropdown-item danger">Delete File</button>
                                            </div>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="file-grid">
                            {/* Render Folders First */}
                            {filteredFolders.map(f => (
                                <div key={f.id} className="file-card" onDoubleClick={() => navigateToFolder(f.id, decryptedNames[f.id] || 'Folder')}>
                                    <div className="file-card-icon" style={{ position: 'relative', width: '100%', cursor: 'pointer' }} onClick={() => navigateToFolder(f.id, decryptedNames[f.id] || 'Folder')}>
                                        <div className="dropdown-container" style={{ position: 'absolute', top: '-10px', right: '-10px' }} onClick={e => e.stopPropagation()}>
                                            <button onClick={(e) => toggleDropdown(e, f.id)} className="btn btn-secondary" style={{ padding: '4px', background: 'transparent', border: 'none', color: 'var(--text-secondary)' }}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/></svg>
                                            </button>
                                            {activeDropdown === f.id && (
                                                <div className="dropdown-menu" style={{ textAlign: 'left' }}>
                                                    <button onClick={() => { handleDeleteFolder(f.id); setActiveDropdown(null); }} disabled={loading} className="dropdown-item danger">Delete Folder</button>
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ background: 'rgba(var(--primary-color-rgb),0.1)', padding: '24px', borderRadius: '50%' }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="var(--primary-color)" viewBox="0 0 16 16">
                                                <path d="M.54 3.87.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.826a2 2 0 0 1-1.991-1.819l-.637-7a1.99 1.99 0 0 1 .342-1.31zM2.19 4a1 1 0 0 0-.996 1.09l.637 7a1 1 0 0 0 .995.91h10.348a1 1 0 0 0 .995-.91l.637-7A1 1 0 0 0 13.81 4H2.19zm4.69-1.707A1 1 0 0 0 6.172 2H2.5a1 1 0 0 0-1 .981l.006.139C1.72 3.042 1.95 3 2.19 3h5.396l-.707-.707z"/>
                                            </svg>
                                        </div>
                                    </div>
                                    <div className="file-card-title" style={{ fontWeight: 600 }}>{decryptedNames[f.id] || f.id}</div>
                                </div>
                            ))}
                            {/* Render Files */}
                            {filteredFiles.map(f => (
                                <div key={f.id} className="file-card">
                                    <div className="file-card-icon" style={{ position: 'relative', width: '100%' }}>
                                        <div className="dropdown-container" style={{ position: 'absolute', top: '-10px', right: '-10px' }}>
                                            <button onClick={(e) => toggleDropdown(e, f.id)} className="btn btn-secondary" style={{ padding: '4px', background: 'transparent', border: 'none', color: 'var(--text-secondary)' }}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/></svg>
                                            </button>
                                            {activeDropdown === f.id && (
                                                <div className="dropdown-menu" style={{ textAlign: 'left' }}>
                                                    {isPreviewable(decryptedNames[f.id] || '') && (
                                                        <button onClick={() => { handlePreview(f.id); setActiveDropdown(null); }} disabled={loading} className="dropdown-item">Preview</button>
                                                    )}
                                                    <button onClick={() => { handleDownload(f.id); setActiveDropdown(null); }} disabled={loading} className="dropdown-item">Download</button>
                                                    <button onClick={() => { handleDelete(f.id); setActiveDropdown(null); }} disabled={loading} className="dropdown-item danger">Delete File</button>
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '24px', borderRadius: '50%' }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="var(--secondary-color)" viewBox="0 0 16 16">
                                                <path d="M4 0h5.293A1 1 0 0 1 10 .293L13.707 4a1 1 0 0 1 .293.707V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2m5.5 1.5v2a1 1 0 0 0 1 1h2z"/>
                                            </svg>
                                        </div>
                                    </div>
                                    <div className="file-card-title">{decryptedNames[f.id] || f.id}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            
            {/* New Folder Modal */}
            {showNewFolderModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)' }}>
                    <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '32px' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '24px' }}>Create New Folder</h3>
                        <form onSubmit={handleCreateFolder}>
                            <div className="form-group">
                                <label>Folder Name</label>
                                <input type="text" className="form-control" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="e.g. Personal Taxes" required autoFocus />
                            </div>
                            <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
                                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowNewFolderModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading || !newFolderName.trim()}>
                                    {loading ? 'Creating...' : 'Create Folder'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {previewData && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', flexDirection: 'column', backdropFilter: 'blur(8px)' }}>
                    <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <h3 style={{ margin: 0, color: 'white' }}>{previewName}</h3>
                        <button onClick={closePreview} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '8px' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854z"/></svg>
                        </button>
                    </div>
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', overflow: 'hidden' }}>
                        {previewType === 'image' && <img src={previewData} alt={previewName!} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '4px' }} />}
                        {previewType === 'pdf' && <iframe src={previewData} style={{ width: '100%', height: '100%', border: 'none', borderRadius: '4px', background: 'white' }} title="PDF Preview" />}
                        {previewType === 'text' && <iframe src={previewData} style={{ width: '100%', height: '100%', border: 'none', borderRadius: '4px', background: 'white' }} title="Text Preview" />}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyVault;
