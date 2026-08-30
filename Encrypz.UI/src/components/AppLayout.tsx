import { Outlet, NavLink, useNavigate } from 'react-router-dom';

export const AppLayout = () => {
    const navigate = useNavigate();

    const handleLogout = () => {
        sessionStorage.clear();
        navigate('/login');
    };

    return (
        <div className="app-layout animate-fade-in">
            <aside className="sidebar">
                <div style={{ marginBottom: '40px', padding: '0 16px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img src="/logo.png" alt="Encrypz Logo" style={{ height: '32px', width: 'auto', borderRadius: '4px' }} />
                        <span style={{ color: 'var(--primary)' }}>Encrypz</span>
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px', paddingLeft: '44px' }}>Zero-Knowledge Vault</p>
                </div>
                <nav style={{ flex: 1, marginTop: '20px' }}>
                    <NavLink 
                        to="/vault" 
                        className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
                        </svg>
                        My Vault
                    </NavLink>
                    
                    <NavLink 
                        to="/recycle-bin" 
                        className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                            <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                        </svg>
                        Recycle Bin
                    </NavLink>
                    

                    <NavLink 
                        to="/profile" 
                        className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
                            <path fillRule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1z"/>
                        </svg>
                        Profile
                    </NavLink>
                </nav>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                    <div style={{ marginBottom: '16px', padding: '0 16px', fontSize: '0.85rem', color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success-color)', boxShadow: '0 0 8px var(--success-color)' }}></span>
                        Drive Connected
                    </div>
                    <button onClick={handleLogout} className="btn btn-secondary" style={{ width: '100%', padding: '10px' }}>
                        Logout
                    </button>
                </div>
            </aside>
            
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
};
