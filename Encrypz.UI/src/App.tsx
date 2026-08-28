import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { ConnectDrive } from './pages/ConnectDrive';
import { AppLayout } from './components/AppLayout';
import { MyVault } from './pages/MyVault';
import { Upload } from './pages/Upload';

import { Profile } from './pages/Profile';

function App() {
  // Simple auth check wrapper
  const RequireAuth = ({ children }: { children: JSX.Element }) => {
    const isConnected = sessionStorage.getItem('isGoogleDriveConnected') === 'true';
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
          <Route path="/upload" element={<Upload />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App;
