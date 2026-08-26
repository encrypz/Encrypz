import React from 'react';
import './Input.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    const id = props.id || props.name || Math.random().toString(36).substring(7);
    
    return (
      <div className={`encrypz-input-wrapper ${className}`}>
        {label && (
          <label htmlFor={id} className="encrypz-label">
            {label}
          </label>
        )}
        <input 
          id={id} 
          ref={ref} 
          className={`encrypz-input ${error ? 'error' : ''}`} 
          {...props} 
        />
        {error && <span className="encrypz-error-msg">{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
