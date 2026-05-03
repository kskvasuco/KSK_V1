import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useOrderStream } from './hooks/useOrderStream';
import styles from './adminStyles.module.css';
import adminApi from './adminApi';

// Inject Inter font once
if (typeof document !== 'undefined' && !document.getElementById('inter-font')) {
    const link = document.createElement('link');
    link.id = 'inter-font';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(link);
}

// SVG Icon components
const Icon = ({ d, size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
    </svg>
);

const Icons = {
    dashboard: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>,
    box: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
    edit: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    wallet: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/><path d="M22 9H2"/></svg>,
    users: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    truck: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
    logout: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    list: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
    settings: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
};

const SectionLabel = ({ title }) => (
    <div className={styles.sidebarSectionLabel}>{title}</div>
);

function AdminLayout() {
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [orderCounts, setOrderCounts] = useState({});
    const navigate = useNavigate();

    const fetchCounts = async () => {
        try {
            const counts = await adminApi.getOrderCounts();
            setOrderCounts(counts || {});
        } catch (err) {
            console.error('Error fetching status counts:', err);
        }
    };

    useEffect(() => {
        if (isAuthenticated) fetchCounts();
    }, [refreshTrigger, isAuthenticated]);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const res = await fetch('/api/admin/check', { credentials: 'include' });
                if (res.ok) setIsAuthenticated(true);
                else navigate('/admin/login');
            } catch {
                navigate('/admin/login');
            } finally {
                setLoading(false);
            }
        };
        checkAuth();
    }, [navigate]);

    useOrderStream(() => {
        setRefreshTrigger(prev => prev + 1);
    }, isAuthenticated);

    const handleLogout = async () => {
        if (window.confirm('Are you sure you want to logout?')) {
            try {
                await adminApi.logout();
                navigate('/admin/login');
            } catch (err) {
                console.error('Logout error:', err);
            }
        }
    };

    useEffect(() => { setIsSidebarOpen(false); }, [navigate]);

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f0f4f8' }}>
                <div className={styles.loadingContainer}>
                    <div className={styles.loadingSpinner}></div>
                    <p style={{ color: '#64748b', fontWeight: 600 }}>Checking authentication...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) return null;

    const navItemClass = ({ isActive }) => `${styles.navItem}${isActive ? ' ' + styles.active : ''}`;
    const topNavClass = ({ isActive }) => `${styles.topNavItem}${isActive ? ' ' + styles.active : ''}`;

    return (
        <div className={styles.adminWrapper}>
            {/* Top Header */}
            <div className={styles.panelHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <button className={styles.menuBtn} onClick={() => setIsSidebarOpen(!isSidebarOpen)}>☰</button>
                    <img src="/images/head.png" alt="KSK" className={styles.headerLogo} />
                    <div className={styles.headerInfo}>
                        <h1 className={styles.headerTitle}>KSK VASU & Co</h1>
                        <p className={styles.headerSubtitle}>Admin Panel</p>
                    </div>
                </div>
                <ClockDisplay styles={styles} />
                <button onClick={handleLogout} className={styles.logoutBtn}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Icons.logout /> Logout
                    </span>
                </button>
            </div>

            <div className={styles.adminContainer}>
                {/* Mobile overlay */}
                <div className={`${styles.overlay} ${isSidebarOpen ? styles.visible : ''}`}
                    onClick={() => setIsSidebarOpen(false)} />

                {/* Sidebar */}
                <nav className={`${styles.sidebar} ${isSidebarOpen ? styles.open : ''}`}>
                    <button className={styles.closeMenuBtn} onClick={() => setIsSidebarOpen(false)}
                        style={{ display: isSidebarOpen ? 'flex' : 'none', alignItems: 'center', gap: '6px' }}>
                        ✕ Close
                    </button>

                    <SectionLabel title="Orders" />
                    <NavLink to="/admin/pending" className={navItemClass}>
                        <Icons.list /> Active Orders
                        <span style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', borderRadius: '20px', padding: '1px 8px', fontSize: '11px', fontWeight: 700 }}>{orderCounts['Ordered'] || 0}</span>
                    </NavLink>
                    <NavLink to="/admin/rate-requested" className={navItemClass}>
                        ⏳ Rate Requested
                        <span style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', borderRadius: '20px', padding: '1px 8px', fontSize: '11px', fontWeight: 700 }}>{orderCounts['Rate Requested'] || 0}</span>
                    </NavLink>
                    <NavLink to="/admin/rate-approved" className={navItemClass}>
                        ✅ Rate Approved
                        <span style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', borderRadius: '20px', padding: '1px 8px', fontSize: '11px', fontWeight: 700 }}>{orderCounts['Rate Approved'] || 0}</span>
                    </NavLink>
                    <NavLink to="/admin/confirmed" className={navItemClass}>
                        📦 Confirmed
                        <span style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', borderRadius: '20px', padding: '1px 8px', fontSize: '11px', fontWeight: 700 }}>{orderCounts['Confirmed'] || 0}</span>
                    </NavLink>
                    <NavLink to="/admin/dispatch" className={navItemClass}>
                        🚚 Dispatch
                        <span style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', borderRadius: '20px', padding: '1px 8px', fontSize: '11px', fontWeight: 700 }}>{orderCounts['DispatchGroup'] || 0}</span>
                    </NavLink>
                    <NavLink to="/admin/delivered" className={navItemClass}>
                        ✔️ Delivered
                        <span style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', borderRadius: '20px', padding: '1px 8px', fontSize: '11px', fontWeight: 700 }}>{orderCounts['Delivered'] || 0}</span>
                    </NavLink>
                    <NavLink to="/admin/paused" className={navItemClass}>
                        ⏸️ Paused
                        <span style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', borderRadius: '20px', padding: '1px 8px', fontSize: '11px', fontWeight: 700 }}>{orderCounts['Paused'] || 0}</span>
                    </NavLink>
                    <NavLink to="/admin/hold" className={navItemClass}>
                        ⏳ Hold
                        <span style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', borderRadius: '20px', padding: '1px 8px', fontSize: '11px', fontWeight: 700 }}>{orderCounts['Hold'] || 0}</span>
                    </NavLink>
                    <NavLink to="/admin/cancelled" className={navItemClass}>
                        ❌ Cancelled
                        <span style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', borderRadius: '20px', padding: '1px 8px', fontSize: '11px', fontWeight: 700 }}>{orderCounts['Cancelled'] || 0}</span>
                    </NavLink>

                    <SectionLabel title="Manage" />
                    <NavLink to="/admin/users" className={navItemClass}>
                        <Icons.users /> Users
                    </NavLink>
                    <NavLink to="/admin/delivery-agents" className={navItemClass}>
                        <Icons.truck /> Delivery Agents
                    </NavLink>
                </nav>

                <div className={styles.contentWrapper}>
                    {/* Feature / Top Navigation Bar */}
                    <div className={styles.featureSection}>
                        <div className={styles.featurePlaceholder}>
                            <NavLink to="/admin" className={topNavClass} end>
                                <Icons.dashboard /> Dashboard
                            </NavLink>
                            <NavLink to="/admin/products" className={topNavClass}>
                                <Icons.box /> Products
                            </NavLink>
                            <NavLink to="/admin/create-order" className={topNavClass}>
                                <Icons.edit /> Create Order
                            </NavLink>
                            <NavLink to="/admin/settings" className={topNavClass}>
                                <Icons.settings /> Settings
                            </NavLink>

                            <div className={styles.topNavDropdown}>
                                <div className={`${styles.topNavItem} ${
                                    window.location.pathname.includes('/admin/balance') ||
                                    window.location.pathname.includes('/admin/advance') ||
                                    window.location.pathname.includes('/admin/completed') ||
                                    window.location.pathname.includes('/admin/payment') ||
                                    window.location.pathname.includes('/admin/report')
                                        ? styles.active : ''}`}>
                                    <Icons.wallet /> Accounts
                                    <span className={styles.dropdownArrowSmall}>▼</span>
                                </div>
                                <div className={styles.topNavDropdownContent}>
                                    <div className={styles.topNavDropdownInner}>
                                        <NavLink to="/admin/balance" className={({ isActive }) => `${styles.topNavDropdownItem}${isActive ? ' ' + styles.active : ''}`}>
                                            💵 Balance ({orderCounts['Balance'] || 0})
                                        </NavLink>
                                        <NavLink to="/admin/advance" className={({ isActive }) => `${styles.topNavDropdownItem}${isActive ? ' ' + styles.active : ''}`}>
                                            💰 Advance ({orderCounts['Advance'] || 0})
                                        </NavLink>
                                        <NavLink to="/admin/completed" className={({ isActive }) => `${styles.topNavDropdownItem}${isActive ? ' ' + styles.active : ''}`}>
                                            ✅ Completed ({orderCounts['Completed'] || 0})
                                        </NavLink>
                                        <NavLink to="/admin/payment" className={({ isActive }) => `${styles.topNavDropdownItem}${isActive ? ' ' + styles.active : ''}`}>
                                            ⚙️ Payment Settings
                                        </NavLink>
                                        <NavLink to="/admin/report" className={({ isActive }) => `${styles.topNavDropdownItem}${isActive ? ' ' + styles.active : ''}`}>
                                            📊 Statement
                                        </NavLink>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <main className={styles.mainContent}>
                        <Outlet context={{ refreshTrigger }} />
                    </main>
                </div>
            </div>
        </div>
    );
}

function ClockDisplay({ styles }) {
    const [time, setTime] = React.useState(new Date());
    React.useEffect(() => {
        const t = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const dateStr = time.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    return (
        <div className={styles.topBannerClock}>
            <div className={styles.clockSection}>
                <span className={styles.clockTime}>{timeStr}</span>
                <span className={styles.clockDate}>{dateStr}</span>
            </div>
            <div className={styles.clockSeparator} />
            <div className={styles.clockEmojiWrapper}>⏰</div>
        </div>
    );
}

export default AdminLayout;
