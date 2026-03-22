import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useOrderStream } from '../admin/hooks/useOrderStream';
import styles from '../admin/adminStyles.module.css';
import staffApi from './staffApi';

function StaffLayout() {
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isAccountsOpen, setIsAccountsOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    // Check authentication on mount
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const res = await fetch('/api/staff/check', { credentials: 'include' });
                if (res.ok) {
                    setIsAuthenticated(true);
                } else {
                    navigate('/staff/login');
                }
            } catch (err) {
                console.error('Auth check error:', err);
                navigate('/staff/login');
            } finally {
                setLoading(false);
            }
        };
        checkAuth();
    }, [navigate]);

    // Connect to SSE for real-time updates
    useOrderStream(() => {
        console.log('Order updated (Staff stream), refreshing...');
        setRefreshTrigger(prev => prev + 1);
    }, isAuthenticated);

    const handleLogout = async () => {
        if (window.confirm('Are you sure you want to logout?')) {
            try {
                await staffApi.logout();
                navigate('/staff/login');
            } catch (err) {
                console.error('Logout error:', err);
            }
        }
    };

    // Close sidebar on route change (mobile)
    useEffect(() => {
        setIsSidebarOpen(false);
    }, [location]);

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

    if (!isAuthenticated) return null;

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
                        <p className={styles.headerSubtitle}>Staff Panel</p>
                    </div>
                </div>
                <button onClick={handleLogout} className={styles.logoutBtn}>🚪 Logout</button>
            </div>

            {/* Special section for future features */}
            <div className={styles.featureSection}>
                <div className={styles.featurePlaceholder}>
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
                    <NavLink to="/staff/create-order" className={styles.navItem}>📝 Create Order</NavLink>
                    <NavLink to="/staff/products" className={styles.navItem}>📦 Products</NavLink>

                    {/* Orders Section */}
                    <SectionHeader title="Orders" />
                    <NavLink to="/staff/pending" className={styles.navItem}>📋 Active Orders</NavLink>
                    <NavLink to="/staff/rate-requested" className={styles.navItem}>💰 Rate Requested</NavLink>
                    <NavLink to="/staff/rate-approved" className={styles.navItem}>✅ Rate Approved</NavLink>
                    <NavLink to="/staff/confirmed" className={styles.navItem}>📦 Confirmed Orders</NavLink>
                    <NavLink to="/staff/dispatch" className={styles.navItem}>🚚 Dispatch</NavLink>
                    <NavLink to="/staff/delivered" className={styles.navItem}>✔️ Delivered</NavLink>
                    <NavLink to="/staff/paused" className={styles.navItem}>⏸️ Paused</NavLink>
                    <NavLink to="/staff/hold" className={styles.navItem}>⏳ On Hold</NavLink>
                    <NavLink to="/staff/cancelled" className={styles.navItem}>❌ Cancelled</NavLink>

                    {/* Manage Section */}
                    <SectionHeader title="Manage" />
                    <NavLink to="/staff/users" className={styles.navItem}>👥 Users</NavLink>

                    {/* Accounts & Payment Dropdown */}
                    <div className={styles.navDropdown}>
                        <button
                            className={styles.navDropdownToggle}
                            onClick={() => setIsAccountsOpen(!isAccountsOpen)}
                        >
                            <span>💳 Accounts & Payment</span>
                            <span className={`${styles.dropdownArrow} ${isAccountsOpen ? styles.open : ''}`}>▼</span>
                        </button>
                        <div className={`${styles.navDropdownContent} ${isAccountsOpen || location.pathname.includes('/staff/balance') || location.pathname.includes('/staff/advance') || location.pathname.includes('/staff/completed') ? styles.open : ''}`}>
                            <NavLink to="/staff/balance" className={({ isActive }) => `${styles.navDropdownItem} ${isActive ? styles.active : ''}`}>
                                💵 Balance
                            </NavLink>
                            <NavLink to="/staff/advance" className={({ isActive }) => `${styles.navDropdownItem} ${isActive ? styles.active : ''}`}>
                                💰 Advance
                            </NavLink>
                            <NavLink to="/staff/completed" className={({ isActive }) => `${styles.navDropdownItem} ${isActive ? styles.active : ''}`}>
                                ✅ Completed Orders
                            </NavLink>
                        </div>
                    </div>

                    <div style={{ marginTop: 'auto', paddingBottom: '20px' }}>
                        <a onClick={handleLogout} className={styles.navItem} style={{ cursor: 'pointer', color: '#ff8a80' }}>🚪 Logout</a>
                    </div>
                </nav>

                <main className={styles.mainContent}>
                    <Outlet context={{ refreshTrigger }} />
                </main>
            </div>
        </div>
    );
}

export default StaffLayout;
