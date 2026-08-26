import React, { useState } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import './Auth.css';

interface AuthProps {
  onLogin: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate crypto key generation delay
    setTimeout(() => {
      setIsLoading(false);
      onLogin();
    }, 1500);
  };

  return (
    <div className="encrypz-auth-container">
      <div className="auth-hero animate-fade-in">
        <h1>Encrypz</h1>
        <p className="subtitle">Zero-knowledge end-to-end encryption vault.</p>
        <div className="crypto-animation">
          <div className="lock-icon"></div>
          <span>Your keys never leave your device.</span>
        </div>
      </div>
      
      <Card className="auth-card animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <h2>{isLogin ? 'Welcome Back' : 'Create Vault'}</h2>
        <p className="auth-desc">
          {isLogin 
            ? 'Enter your credentials to decrypt your local vault.'
            : 'Your master password generates a strong local encryption key.'}
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <Input 
            label="Username" 
            placeholder="Enter your username" 
            required 
            autoComplete="username"
          />
          <Input 
            label="Master Password" 
            type="password" 
            placeholder="Enter a strong password" 
            required 
            autoComplete={isLogin ? 'current-password' : 'new-password'}
          />
          
          <Button type="submit" isLoading={isLoading} className="submit-btn">
            {isLogin ? 'Decrypt & Login' : 'Generate Keys & Register'}
          </Button>
        </form>

        <div className="auth-toggle">
          <Button variant="ghost" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "Don't have a vault? Create one" : 'Already have a vault? Login'}
          </Button>
        </div>
      </Card>
    </div>
  );
};
