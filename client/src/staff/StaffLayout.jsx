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
    const [orderCounts, setOrderCounts] = useState({});
    const navigate = useNavigate();
    const location = useLocation();

    const fetchCounts = async () => {
        try {
            const counts = await staffApi.getOrderCounts();
            setOrderCounts(counts || {});
        } catch (err) {
            console.error('Error fetching status counts:', err);
        }
    };

    // Re-fetch counts when refreshTrigger or authentication changes
    useEffect(() => {
        if (isAuthenticated) {
            fetchCounts();
        }
    }, [refreshTrigger, isAuthenticated]);

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
                <ClockDisplay styles={styles} />
            </div>

            {/* Special section for future features */}
            <div className={styles.featureSection}>
                <div className={styles.featurePlaceholder}>
                    <button onClick={handleLogout} className={styles.logoutBtn} style={{ marginLeft: 'auto' }}>🚪 Logout</button>
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
                    <NavLink to="/staff/pending" className={styles.navItem}>📋 Active Orders ({orderCounts['Ordered'] || 0})</NavLink>
                    <NavLink to="/staff/rate-requested" className={styles.navItem}>💰 Rate Requested ({orderCounts['Rate Requested'] || 0})</NavLink>
                    <NavLink to="/staff/rate-approved" className={styles.navItem}>✅ Rate Approved ({orderCounts['Rate Approved'] || 0})</NavLink>
                    <NavLink to="/staff/confirmed" className={styles.navItem}>📦 Confirmed Orders ({orderCounts['Confirmed'] || 0})</NavLink>
                    <NavLink to="/staff/dispatch" className={styles.navItem}>🚚 Dispatch ({orderCounts['DispatchGroup'] || 0})</NavLink>
                    <NavLink to="/staff/delivered" className={styles.navItem}>✔️ Delivered ({orderCounts['Delivered'] || 0})</NavLink>
                    <NavLink to="/staff/paused" className={styles.navItem}>⏸️ Paused ({orderCounts['Paused'] || 0})</NavLink>
                    <NavLink to="/staff/hold" className={styles.navItem}>⏳ On Hold ({orderCounts['Hold'] || 0})</NavLink>
                    <NavLink to="/staff/cancelled" className={styles.navItem}>❌ Cancelled ({orderCounts['Cancelled'] || 0})</NavLink>

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
                                💵 Balance ({orderCounts['Balance'] || 0})
                            </NavLink>
                            <NavLink to="/staff/advance" className={({ isActive }) => `${styles.navDropdownItem} ${isActive ? styles.active : ''}`}>
                                💰 Advance ({orderCounts['Advance'] || 0})
                            </NavLink>
                            <NavLink to="/staff/completed" className={({ isActive }) => `${styles.navDropdownItem} ${isActive ? styles.active : ''}`}>
                                ✅ Completed Orders ({orderCounts['Completed'] || 0})
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
            <div className={styles.clockEmojiWrapper}>⏰</div>
        </div>
    );
}

export default StaffLayout;
