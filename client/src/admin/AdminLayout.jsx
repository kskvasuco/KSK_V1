import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useOrderStream } from './hooks/useOrderStream';
import styles from './adminStyles.module.css';

function AdminLayout() {
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
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
                await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
                navigate('/admin/login');
            } catch (err) {
                console.error('Logout error:', err);
            }
        }
    };

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

    return (
        <div className={styles.adminContainer}>
            <nav className={styles.sidebar}>
                <div className={styles.sidebarHeader}>
                    <img src="/images/head.png" alt="KSK" className={styles.sidebarLogo} />
                    <div className={styles.sidebarTitle}>KSK VASU & Co</div>
                    <div className={styles.sidebarSubtitle}>Admin Panel</div>
                </div>

                <NavLink to="/admin" className={styles.navItem} end>📊 Dashboard</NavLink>
                <NavLink to="/admin/products" className={styles.navItem}>📦 Products</NavLink>
                <NavLink to="/admin/pending" className={styles.navItem}>📋 Active Orders</NavLink>
                <NavLink to="/admin/rate-requested" className={styles.navItem}>💰 Rate Requested</NavLink>
                <NavLink to="/admin/rate-approved" className={styles.navItem}>✅ Rate Approved</NavLink>
                <NavLink to="/admin/confirmed" className={styles.navItem}>📦 Confirmed Orders</NavLink>
                <NavLink to="/admin/dispatch" className={styles.navItem}>🚚 Dispatch</NavLink>
                <NavLink to="/admin/balance" className={styles.navItem}>💵 Balance</NavLink>
                <NavLink to="/admin/delivered" className={styles.navItem}>✔️ Delivered</NavLink>
                <NavLink to="/admin/paused" className={styles.navItem}>⏸️ Paused Orders</NavLink>
                <NavLink to="/admin/hold" className={styles.navItem}>⏳ Hold Orders</NavLink>
                <NavLink to="/admin/cancelled" className={styles.navItem}>❌ Cancelled</NavLink>
            </nav>

            <main className={styles.mainContent}>
                <div className={styles.panelHeader}>
                    <div className={styles.headerLeft}>
                        <img src="/images/head.png" alt="KSK" className={styles.headerLogo} />
                        <div className={styles.headerInfo}>
                            <h1 className={styles.headerTitle}>KSK VASU & Co</h1>
                            <p className={styles.headerSubtitle}>Admin Dashboard • கட்டுமான பொருட்கள்</p>
                        </div>
                    </div>
                    <div className={styles.headerRight}>
                        <button onClick={handleLogout} className={styles.logoutBtn}>🚪 Logout</button>
                    </div>
                </div>

                <Outlet context={{ refreshTrigger }} />
            </main>
        </div>
    );
}

export default AdminLayout;
