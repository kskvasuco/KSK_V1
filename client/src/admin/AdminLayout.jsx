import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useOrderStream } from './hooks/useOrderStream';
import styles from './adminStyles.module.css';
import adminApi from './adminApi';

function AdminLayout() {
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isAccountsOpen, setIsAccountsOpen] = useState(false);
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

    // Re-fetch counts when refreshTrigger changes
    useEffect(() => {
        if (isAuthenticated) {
            fetchCounts();
        }
    }, [refreshTrigger, isAuthenticated]);

    // Check authentication on mount
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const res = await fetch('/api/admin/check', {
                    credentials: 'include'
                });
                if (res.ok) {
                    setIsAuthenticated(true);
                } else {
                    // Not authenticated, redirect to login
                    navigate('/admin/login');
                }
            } catch (err) {
                console.error('Auth check error:', err);
                navigate('/admin/login');
            } finally {
                setLoading(false);
            }
        };
        checkAuth();
    }, [navigate]);

    // Connect to SSE for real-time updates (only if authenticated)
    useOrderStream(() => {
        console.log('Order updated, refreshing...');
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

    // Close sidebar on route change (mobile)
    useEffect(() => {
        setIsSidebarOpen(false);
    }, [navigate]);

    // Show loading while checking authentication
    if (loading) {
        return (
            <div className={styles.adminContainer}>
                <div className={styles.loadingContainer}>
                    <div className={styles.loadingSpinner}></div>
                    <p>Checking authentication...</p>
                </div>
            </div>
        );
    }

    // Don't render anything if not authenticated (will redirect)
    if (!isAuthenticated) {
        return null;
    }

    // Helper for section headers
    const SectionHeader = ({ title }) => (
        <div style={{ padding: '15px 20px 5px', fontSize: '11px', fontWeight: 'bold', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {title}
        </div>
    );

    return (
        <div className={styles.adminWrapper}>
            <div className={styles.panelHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button
                        className={styles.menuBtn}
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    >
                        ☰
                    </button>
                    <img src="/images/head.png" alt="KSK" className={styles.headerLogo} />
                    <div className={styles.headerInfo}>
                        <h1 className={styles.headerTitle}>KSK VASU & Co</h1>
                        <p className={styles.headerSubtitle}>Admin Panel</p>
                    </div>
                </div>
                <button onClick={handleLogout} className={styles.logoutBtn}>🚪 Logout</button>
            </div>
            {/* Special section for future features */}
            <div className={styles.featureSection}>
                <div className={styles.featurePlaceholder}>
                    <NavLink to="/admin" className={({ isActive }) => `${styles.topNavItem} ${isActive ? styles.active : ''}`} end>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" />
                        </svg>
                        Dashboard
                    </NavLink>

                    <NavLink to="/admin/products" className={({ isActive }) => `${styles.topNavItem} ${isActive ? styles.active : ''}`}>
                        📦 Products
                    </NavLink>

                    <NavLink to="/admin/create-order" className={({ isActive }) => `${styles.topNavItem} ${isActive ? styles.active : ''}`}>
                        📝 Create Order
                    </NavLink>

                    {/* Accounts & Payment Top Dropdown */}
                    <div className={styles.topNavDropdown}>
                        <div className={`${styles.topNavItem} ${window.location.pathname.includes('/admin/balance') || window.location.pathname.includes('/admin/advance') || window.location.pathname.includes('/admin/completed') ? styles.active : ''}`}>
                            💳 Accounts & Payment <span className={styles.dropdownArrowSmall}>▼</span>
                        </div>
                        <div className={styles.topNavDropdownContent}>
                            <NavLink to="/admin/balance" className={({ isActive }) => `${styles.topNavDropdownItem} ${isActive ? styles.active : ''}`}>
                                💵 Balance
                            </NavLink>
                            <NavLink to="/admin/advance" className={({ isActive }) => `${styles.topNavDropdownItem} ${isActive ? styles.active : ''}`}>
                                💰 Advance
                            </NavLink>
                            <NavLink to="/admin/completed" className={({ isActive }) => `${styles.topNavDropdownItem} ${isActive ? styles.active : ''}`}>
                                ✅ Completed Orders ({orderCounts['Completed'] || 0})
                            </NavLink>
                            <NavLink to="/admin/payment" className={({ isActive }) => `${styles.topNavDropdownItem} ${isActive ? styles.active : ''}`}>
                                ⚙️ Payment Settings
                            </NavLink>
                        </div>
                    </div>

                    {/* Dynamic Clock Section */}
                    <ClockDisplay styles={styles} />
                </div>
            </div>

            <div className={styles.adminContainer}>
                {/* Overlay for mobile */}
                <div
                    className={`${styles.overlay} ${isSidebarOpen ? styles.visible : ''}`}
                    onClick={() => setIsSidebarOpen(false)}
                ></div>

                <nav className={`${styles.sidebar} ${isSidebarOpen ? styles.open : ''}`}>
                    <button
                        className={styles.closeMenuBtn}
                        onClick={() => setIsSidebarOpen(false)}
                        style={{ display: isSidebarOpen ? 'block' : 'none', color: '#fff' }}
                    >
                        ✕
                    </button>

                    {/* Orders Section */}
                    <SectionHeader title="Orders" />
                    <NavLink to="/admin/pending" className={styles.navItem}>📋 Active Orders ({orderCounts['Ordered'] || 0})</NavLink>
                    <NavLink to="/admin/rate-requested" className={styles.navItem}>⏳ Rate Requested ({orderCounts['Rate Requested'] || 0})</NavLink>
                    <NavLink to="/admin/rate-approved" className={styles.navItem}>✅ Rate Approved ({orderCounts['Rate Approved'] || 0})</NavLink>
                    <NavLink to="/admin/confirmed" className={styles.navItem}>📦 Confirmed Orders ({orderCounts['Confirmed'] || 0})</NavLink>
                    <NavLink to="/admin/dispatch" className={styles.navItem}>🚚 Dispatch ({orderCounts['DispatchGroup'] || 0})</NavLink>
                    <NavLink to="/admin/delivered" className={styles.navItem}>✔️ Delivered ({orderCounts['Delivered'] || 0})</NavLink>
                    <NavLink to="/admin/paused" className={styles.navItem}>⏸️ Paused Orders ({orderCounts['Paused'] || 0})</NavLink>
                    <NavLink to="/admin/hold" className={styles.navItem}>⏳ Hold Orders ({orderCounts['Hold'] || 0})</NavLink>
                    <NavLink to="/admin/cancelled" className={styles.navItem}>❌ Cancelled ({orderCounts['Cancelled'] || 0})</NavLink>

                    {/* Manage Section */}
                    <SectionHeader title="Manage" />
                    <NavLink to="/admin/users" className={styles.navItem}>👥 Users</NavLink>
                    <NavLink to="/admin/delivery-agents" className={styles.navItem}>🚚 Delivery Agents</NavLink>
                </nav>

                <main className={styles.mainContent}>
                    <Outlet context={{ refreshTrigger }} />
                </main>
            </div>
        </div>
    );
}

// Helper for Dynamic Clock
function ClockDisplay({ styles }) {
    const [time, setTime] = React.useState(new Date());

    React.useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const dateStr = time.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

    return (
        <div className={styles.topBannerClock}>
            <div className={styles.clockSection}>
                <span className={styles.clockTime}>{timeStr}</span>
                <span className={styles.clockDate}>{dateStr}</span>
            </div>
            <div className={styles.clockSeparator}></div>
            <div style={{ fontSize: '18px' }}>⏰</div>
        </div>
    );
}

export default AdminLayout;
