import React from 'react';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="encrypz-modal-overlay animate-fade-in" onClick={onClose}>
      <div className="encrypz-modal-content glass-panel" onClick={e => e.stopPropagation()}>
        {title && (
          <div className="encrypz-modal-header">
            <h3>{title}</h3>
            <button className="encrypz-modal-close" onClick={onClose}>&times;</button>
          </div>
        )}
        <div className="encrypz-modal-body">
          {children}
        </div>
      </div>
    </div>
  );
};
