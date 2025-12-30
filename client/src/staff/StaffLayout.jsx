import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useOrderStream } from '../admin/hooks/useOrderStream';
import styles from '../admin/adminStyles.module.css';
import staffApi from './staffApi';

function StaffLayout() {
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
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
        <div className={styles.adminContainer}>
            <nav className={styles.sidebar}>
                <div className={styles.sidebarHeader}>
                    <img src="/images/head.png" alt="KSK" className={styles.sidebarLogo} />
                    <div className={styles.sidebarTitle}>KSK VASU & Co</div>
                    <div className={styles.sidebarSubtitle}>Staff Panel</div>
                </div>

                {/* Dashboard / Products */}
                <NavLink to="/staff" className={styles.navItem} end>📊 Dashboard</NavLink>
                <NavLink to="/staff/products" className={styles.navItem}>📦 Products</NavLink>

                {/* Orders Section */}
                <SectionHeader title="Orders" />
                <NavLink to="/staff/pending" className={styles.navItem}>📋 Active Orders</NavLink>
                <NavLink to="/staff/rate-requested" className={styles.navItem}>💰 Rate Requested</NavLink>
                <NavLink to="/staff/rate-approved" className={styles.navItem}>✅ Rate Approved</NavLink>
                <NavLink to="/staff/confirmed" className={styles.navItem}>📦 Confirmed Orders</NavLink>
                <NavLink to="/staff/dispatch" className={styles.navItem}>🚚 Dispatch</NavLink>
                <NavLink to="/staff/balance" className={styles.navItem}>💵 Balance View</NavLink>
                <NavLink to="/staff/paused" className={styles.navItem}>⏸️ Paused</NavLink>
                <NavLink to="/staff/hold" className={styles.navItem}>⏳ On Hold</NavLink>
                <NavLink to="/staff/delivered" className={styles.navItem}>✔️ Delivered</NavLink>
                <NavLink to="/staff/cancelled" className={styles.navItem}>❌ Cancelled</NavLink>

                {/* Manage Section */}
                <SectionHeader title="Manage" />
                <NavLink to="/staff/create-order" className={styles.navItem}>📝 Create Order</NavLink>
                <NavLink to="/staff/users" className={styles.navItem}>👥 Visited Users</NavLink>

                <div style={{ marginTop: 'auto', paddingBottom: '20px' }}>
                    <a onClick={handleLogout} className={styles.navItem} style={{ cursor: 'pointer', color: '#ff8a80' }}>🚪 Logout</a>
                </div>
            </nav>

            <main className={styles.mainContent}>
                <div className={styles.panelHeader}>
                    <div className={styles.headerLeft}>
                        <img src="/images/head.png" alt="KSK" className={styles.headerLogo} />
                        <div className={styles.headerInfo}>
                            <h1 className={styles.headerTitle}>KSK VASU & Co</h1>
                            <p className={styles.headerSubtitle}>Staff Dashboard • கட்டுமான பொருட்கள்</p>
                        </div>
                    </div>
                    <div className={styles.headerRight}>
                        <button onClick={handleLogout} className={styles.logoutBtn}>🚪 Logout</button>
                    </div>
                </div>

                <div className={styles.contentArea}>
                    <Outlet context={{ refreshTrigger }} />
                </div>
            </main>
        </div>
    );
}

export default StaffLayout;
