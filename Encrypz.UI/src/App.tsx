import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { ConnectDrive } from './pages/ConnectDrive';
import { AppLayout } from './components/AppLayout';
import { MyVault } from './pages/MyVault';
import { Upload } from './pages/Upload';
import { RecycleBin } from './pages/RecycleBin';

import { Profile } from './pages/Profile';

import type { ReactNode } from 'react';

function App() {
  const RequireAuth = ({ children }: { children: ReactNode }) => {
    const userId = sessionStorage.getItem('userId');
    const isConnected = sessionStorage.getItem('isGoogleDriveConnected') === 'true';
    
    if (!userId) {
      return <Navigate to="/login" replace />;
    }
    
    if (!isConnected) {
      return <Navigate to="/connect" replace />;
    }
    return children;
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/connect" element={<ConnectDrive />} />
        
        {/* Protected Routes inside AppLayout */}
        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route path="/vault" element={<MyVault />} />
          <Route path="/recycle-bin" element={<RecycleBin />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App;
