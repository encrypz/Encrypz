import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { getVaultKey } from './utils/crypto';
import { AppLayout } from './components/AppLayout';
import { MyVault } from './pages/MyVault';
import { Upload } from './pages/Upload';
import { RecycleBin } from './pages/RecycleBin';

import { Profile } from './pages/Profile';
import { ImportVault } from './pages/ImportVault';

import type { ReactNode } from 'react';

const RequireAuth = ({ children }: { children: ReactNode }) => {
    const userId = sessionStorage.getItem('userId');
    const isConnected = sessionStorage.getItem('isGoogleDriveConnected') === 'true';
    
    if (!userId || !getVaultKey()) {
      return <Navigate to="/login" replace />;
    }
    
    if (!isConnected) {
      return <Navigate to="/connect" replace />;
    }
    return children;
  };

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/connect" element={<Navigate to="/login" replace />} />
        
        {/* Protected Routes inside AppLayout */}
        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route path="/vault" element={<MyVault />} />
          <Route path="/recycle-bin" element={<RecycleBin />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/import" element={<ImportVault />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App;
