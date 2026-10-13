import { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { deriveKey, getVaultKey, encryptName, encryptData, decryptData, base64ToArrayBuffer, arrayBufferToBase64, uint8ArrayToString } from '../utils/crypto';

const API = import.meta.env.VITE_API_URL || '/api';
type LegacyFolder = { id: string; parentId: string | null; name: string; iv: string; tag: string; isDeleted: boolean };
type LegacyFile = { id: string; driveFileId: string; filename: string; folderId: string | null; iv: string; tag: string; isDeleted: boolean };
type LegacyBundle = { format: string; username: string; folders: LegacyFolder[]; files: LegacyFile[] };

export const ImportVault = () => {
    const [bundle, setBundle] = useState<LegacyBundle | null>(null);
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState('');
    const [busy, setBusy] = useState(false);
    const [finished, setFinished] = useState(false);
    // Retain progress in memory after a partial failure to avoid duplicate successful uploads on retry.
    const [folderMap] = useState(() => new Map<string, string>());
    const [imported] = useState(() => new Map<string, string>());
    const userId = sessionStorage.getItem('userId');
    const run = async (e: React.FormEvent) => {
        e.preventDefault();
        const key = getVaultKey();
        if (!key || !bundle || !userId) return;
        setBusy(true);
        try {
            const oldKey = await deriveKey(password, bundle.username);
            const names = new Map<string, string>();
            // Check the old password against every folder before writing folder records.
            for (const f of bundle.folders) names.set(f.id, uint8ArrayToString(await decryptData(base64ToArrayBuffer(f.name), base64ToArrayBuffer(f.iv), base64ToArrayBuffer(f.tag), oldKey)));
            // With file-only vaults, check a file before writing anything.
            let firstPayload: Uint8Array | null = null;
            if (bundle.files.length) {
                const f = bundle.files[0];
                const response = await axios.get(`${API}/legacy-import/${encodeURIComponent(f.driveFileId)}`, { responseType: 'arraybuffer' });
                firstPayload = await decryptData(new Uint8Array(response.data), base64ToArrayBuffer(f.iv), base64ToArrayBuffer(f.tag), oldKey);
            }
            const pending = bundle.folders.filter(f => !folderMap.has(f.id));
            while (pending.length) {
                const index = pending.findIndex(f => !f.parentId || folderMap.has(f.parentId) || !bundle.folders.some(p => p.id === f.parentId));
                if (index < 0) throw new Error('The export contains a cyclic folder hierarchy.');
                const [f] = pending.splice(index, 1);
                const encrypted = await encryptData(new TextEncoder().encode(names.get(f.id)!), key);
                const { data } = await axios.post(`${API}/Folders`, { userId, parentFolderId: f.parentId ? folderMap.get(f.parentId) : null,
                    encryptedFolderName: arrayBufferToBase64(encrypted.payload), initializationVector: arrayBufferToBase64(encrypted.iv), authenticationTag: arrayBufferToBase64(encrypted.authTag) });
                folderMap.set(f.id, data.id);
            }
            for (let i = 0; i < bundle.files.length; i++) {
                const f = bundle.files[i];
                if (imported.has(f.id)) {
                    if (f.isDeleted) await axios.delete(`${API}/Files/${imported.get(f.id)}`);
                    continue;
                }
                setStatus(`Importing file ${i + 1} of ${bundle.files.length}...`);
                let plain = i === 0 ? firstPayload : null;
                if (!plain) {
                    const response = await axios.get(`${API}/legacy-import/${encodeURIComponent(f.driveFileId)}`, { responseType: 'arraybuffer' });
                    plain = await decryptData(new Uint8Array(response.data), base64ToArrayBuffer(f.iv), base64ToArrayBuffer(f.tag), oldKey);
                }
                const encrypted = await encryptData(plain, key);
                const { data } = await axios.post(`${API}/Files`, { userId, folderId: f.folderId ? folderMap.get(f.folderId) : null,
                    encryptedFileName: await encryptName(f.filename, key), fileSize: plain.byteLength,
                    payload: arrayBufferToBase64(encrypted.payload), initializationVector: arrayBufferToBase64(encrypted.iv), authenticationTag: arrayBufferToBase64(encrypted.authTag) });
                imported.set(f.id, data.id);
                if (f.isDeleted) await axios.delete(`${API}/Files/${data.id}`);
            }
            // Trash children before parents; original encrypted files are never deleted.
            for (const id of [...folderMap.keys()].reverse()) {
                const f = bundle.folders.find(folder => folder.id === id)!;
                if (!f.isDeleted) continue;
                try { await axios.delete(`${API}/Folders/${folderMap.get(f.id)}`); }
                catch { throw new Error('Files imported, but a folder could not be moved to the recycle bin. Review your imported folders.'); }
            }
            setPassword(''); setFinished(true);
            setStatus('Import complete. Your original Google Drive files and database export are unchanged.');
        } catch (error) {
            setStatus(error instanceof Error ? `Import stopped: ${error.message}. Check the original password and Google account. Successfully imported items remain in your vault.` : 'Import failed.');
        } finally { setBusy(false); }
    };
    return <div className="glass-panel" style={{ padding: 28 }}>
        <h2>Import an older vault</h2>
        <p>Select the metadata bundle prepared from your old database exports. Sign in with the Google account that holds the original files. The original master password is used only in this browser.</p>
        <p>Import copies and re-encrypts files into this vault. Keep this page open until it finishes. Starting a new import after reloading can create duplicates.</p>
        <form onSubmit={run}>
            <label>Metadata bundle <input type="file" accept=".json" required disabled={busy || finished || imported.size > 0 || folderMap.size > 0} onChange={async e => {
                try {
                    const parsed = JSON.parse(await e.target.files![0].text());
                    if (parsed.format !== 'encrypz-legacy-v1' || !parsed.username || !Array.isArray(parsed.files) || !Array.isArray(parsed.folders)) throw new Error('Invalid legacy bundle.');
                    setBundle(parsed); setStatus('');
                } catch { setBundle(null); setStatus('Choose a valid Encrypz legacy metadata bundle.'); }
            }} /></label>
            <label>Original master password <input className="auth-input" type="password" autoComplete="off" required value={password} onChange={e => setPassword(e.target.value)} disabled={busy || finished} /></label>
            <button className="btn btn-primary" disabled={busy || !bundle || finished}>{busy ? 'Importing...' : 'Import encrypted files'}</button>
        </form>
        <p role="status">{status}</p>
        <Link to="/vault">Back to vault</Link>
    </div>;
};
