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
    const navigate = useNavigate();

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
                    {/* Add your custom content here in the future */}
                    <p className={styles.placeholderText}> </p>
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
                    {/* Dashboard / Products */}
                    <NavLink to="/admin" className={styles.navItem} end>📊 Dashboard</NavLink>
                    <NavLink to="/admin/products" className={styles.navItem}>📦 Products</NavLink>

                    {/* Orders Section */}
                    <SectionHeader title="Orders" />
                    <NavLink to="/admin/pending" className={styles.navItem}>📋 Active Orders</NavLink>
                    <NavLink to="/admin/rate-requested" className={styles.navItem}>💰 Rate Requested</NavLink>
                    <NavLink to="/admin/rate-approved" className={styles.navItem}>✅ Rate Approved</NavLink>
                    <NavLink to="/admin/confirmed" className={styles.navItem}>📦 Confirmed Orders</NavLink>
                    <NavLink to="/admin/dispatch" className={styles.navItem}>🚚 Dispatch</NavLink>
                    <NavLink to="/admin/delivered" className={styles.navItem}>✔️ Delivered</NavLink>
                    <NavLink to="/admin/paused" className={styles.navItem}>⏸️ Paused Orders</NavLink>
                    <NavLink to="/admin/hold" className={styles.navItem}>⏳ Hold Orders</NavLink>
                    <NavLink to="/admin/cancelled" className={styles.navItem}>❌ Cancelled</NavLink>

                    {/* Manage Section */}
                    <SectionHeader title="Manage" />
                    <NavLink to="/admin/create-order" className={styles.navItem}>📝 Create Order</NavLink>
                    <NavLink to="/admin/users" className={styles.navItem}>👥 Users</NavLink>
                    <NavLink to="/admin/delivery-agents" className={styles.navItem}>🚚 Delivery Agents</NavLink>

                    {/* Accounts & Payment Dropdown */}
                    <div className={styles.navDropdown}>
                        <button
                            className={styles.navDropdownToggle}
                            onClick={() => setIsAccountsOpen(!isAccountsOpen)}
                        >
                            <span>💳 Accounts & Payment</span>
                            <span className={`${styles.dropdownArrow} ${isAccountsOpen ? styles.open : ''}`}>▼</span>
                        </button>
                        <div className={`${styles.navDropdownContent} ${isAccountsOpen || window.location.pathname.includes('/admin/balance') || window.location.pathname.includes('/admin/payment') || window.location.pathname.includes('/admin/advance') || window.location.pathname.includes('/admin/completed') ? styles.open : ''}`}>
                            <NavLink to="/admin/balance" className={({ isActive }) => `${styles.navDropdownItem} ${isActive ? styles.active : ''}`}>
                                💵 Balance
                            </NavLink>
                            <NavLink to="/admin/advance" className={({ isActive }) => `${styles.navDropdownItem} ${isActive ? styles.active : ''}`}>
                                💰 Advance
                            </NavLink>
                            <NavLink to="/admin/completed" className={({ isActive }) => `${styles.navDropdownItem} ${isActive ? styles.active : ''}`}>
                                ✅ Completed Orders
                            </NavLink>
                            <NavLink to="/admin/payment" className={({ isActive }) => `${styles.navDropdownItem} ${isActive ? styles.active : ''}`}>
                                ⚙️ Payment Settings
                            </NavLink>
                        </div>
                    </div>
                </nav>

                <main className={styles.mainContent}>
                    <Outlet context={{ refreshTrigger }} />
                </main>
            </div>
        </div>
    );
}

export default AdminLayout;
