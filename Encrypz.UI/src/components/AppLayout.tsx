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
                    <h2 style={{ margin: 0, fontSize: '1.8rem' }}>
                        <span style={{ color: 'var(--primary-color)' }}>Encrypz</span>
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>Zero-Knowledge Vault</p>
                </div>
                
                <nav style={{ flex: 1 }}>
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
                        to="/upload" 
                        className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
                            <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/>
                        </svg>
                        Upload Files
                    </NavLink>
                </nav>

                <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: '24px' }}>
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
