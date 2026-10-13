import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../pages/AuthLayout.css';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const [modalContent, setModalContent] = useState<{ title: string; content: React.ReactNode } | null>(null);

  const openModal = (title: string, content: React.ReactNode) => {
    setModalContent({ title, content });
  };

  const closeModal = () => {
    setModalContent(null);
  };

  return (
    <div className="auth-wrapper">
      {/* Top Header */}
      <header className="auth-header">
        <div className="auth-logo-group" onClick={() => navigate('/')}>
          <img src="/logo.png" alt="Encrypz" className="auth-logo-img" />
          <span className="auth-logo-text">ENCRYPZ</span>
        </div>
        <a
          href="#business"
          className="auth-header-link"
          onClick={(e) => {
            e.preventDefault();
            openModal(
              'Encrypz for Business',
              <>
                <p>
                  <strong>Zero-Knowledge Cloud Infrastructure for Enterprise Teams</strong>
                </p>
                <p>
                  Encrypz for Business enables organizations to unite multiple Google Drive workspaces under unified, 
                  zero-knowledge client-side encryption. Each team member accesses an isolated private vault, 
                  preventing unauthorized file exposure even across shared cloud drives.
                </p>
                <p>Contact enterprise sales: <code>enterprise@encrypz.io</code></p>
              </>
            );
          }}
        >
          Encrypz for Business
        </a>
      </header>

      {/* Main Content Area */}
      <main className="auth-main-content">
        {children}
      </main>

      {/* Bottom Footer */}
      <footer className="auth-footer">
        <div className="auth-footer-version">V 1.0.0</div>
        <div className="auth-footer-links">
          <a
            href="#help"
            className="auth-footer-link"
            onClick={(e) => {
              e.preventDefault();
              openModal(
                'Encrypz Help Centre',
                <>
                  <p><strong>Frequently Asked Questions</strong></p>
                  <p><strong>How does client-side encryption work?</strong></p>
                  <p>Your files are encrypted in your browser using AES-GCM-256 before upload. Encrypz never sees your plaintext files or your master password.</p>
                  <p><strong>Can I connect multiple Google accounts?</strong></p>
                  <p>Yes! In your profile and vault, you can link multiple Google Drive accounts to pool storage into one unified vault.</p>
                </>
              );
            }}
          >
            Help Centre
          </a>
          <a
            href="#terms"
            className="auth-footer-link"
            onClick={(e) => {
              e.preventDefault();
              openModal(
                'Terms of Service',
                <>
                  <p><strong>Terms of Service & Privacy Principles</strong></p>
                  <p>
                    By using Encrypz, you acknowledge that your vault is protected with zero-knowledge cryptographic keys derived on your device. 
                    Because Encrypz does not store your master password, lost passwords cannot be recovered by administrators.
                  </p>
                  <p>
                    All files stored in your connected Google Drive accounts remain under your control and ownership.
                  </p>
                </>
              );
            }}
          >
            Terms of Service
          </a>
          <div className="auth-lang-select" title="Language: English">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
            <span>EN</span>
          </div>
        </div>
      </footer>

      {/* Info Modal */}
      {modalContent && (
        <div className="auth-modal-overlay" onClick={closeModal}>
          <div className="auth-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="auth-modal-header">
              <h3 className="auth-modal-title">{modalContent.title}</h3>
              <button className="auth-modal-close" onClick={closeModal} aria-label="Close">
                &times;
              </button>
            </div>
            <div className="auth-modal-body">{modalContent.content}</div>
          </div>
        </div>
      )}
    </div>
  );
};
