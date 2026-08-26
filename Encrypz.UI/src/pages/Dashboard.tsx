import React, { useState } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import './Dashboard.css';

interface EncryptedFile {
  id: string;
  name: string;
  size: string;
  date: string;
}

interface DashboardProps {
  onLogout: () => void;
}

const mockFiles: EncryptedFile[] = [
  { id: '1', name: 'Q3_Financial_Report.pdf', size: '2.4 MB', date: '2026-08-27' },
  { id: '2', name: 'Server_Private_Keys.pem', size: '4 KB', date: '2026-08-26' },
  { id: '3', name: 'Client_Database_Backup.sql', size: '145 MB', date: '2026-08-25' },
];

export const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const [files, setFiles] = useState<EncryptedFile[]>(mockFiles);
  const [isUploading, setIsUploading] = useState(false);

  const handleSimulateUpload = () => {
    setIsUploading(true);
    setTimeout(() => {
      setFiles([
        { id: Math.random().toString(), name: 'New_Encrypted_Document.docx', size: '1.1 MB', date: new Date().toISOString().split('T')[0] },
        ...files
      ]);
      setIsUploading(false);
    }, 2000);
  };

  return (
    <div className="encrypz-dashboard-container animate-fade-in">
      <header className="dashboard-header glass-panel">
        <div className="header-brand">
          <div className="brand-logo">E</div>
          <h2>Encrypz Vault</h2>
        </div>
        <div className="header-actions">
          <Button variant="ghost" onClick={onLogout}>Lock Vault</Button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-toolbar">
          <h3>Your Files</h3>
          <Button onClick={handleSimulateUpload} isLoading={isUploading}>
            {isUploading ? 'Encrypting & Uploading...' : 'Upload File'}
          </Button>
        </div>

        <div className="file-grid">
          {files.map((file, index) => (
            <Card 
              key={file.id} 
              className="file-card animate-fade-in" 
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="file-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
              </div>
              <div className="file-details">
                <p className="file-name">{file.name}</p>
                <div className="file-meta">
                  <span>{file.size}</span>
                  <span className="dot">•</span>
                  <span>{file.date}</span>
                </div>
              </div>
              <div className="file-actions">
                <Button variant="secondary" className="action-btn">Download & Decrypt</Button>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};
