import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../admin/adminStyles.module.css'; // Reusing admin styles
import staffApi from './staffApi';

function StaffLogin() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Check if already logged in
    useEffect(() => {
        const checkAuth = async () => {
            try {
                // Use staff API to check session
                await staffApi.checkSession();
                // If successful (no error thrown), redirect to staff dashboard
                navigate('/staff');
            } catch (err) {
                // Not authenticated, stay on login page
                console.log('Not authenticated');
            }
        };
        checkAuth();
    }, [navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await staffApi.login(username, password);
            // Login successful
            navigate('/staff');
        } catch (err) {
            console.error('Login error:', err);
            setError('Invalid credentials or server error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.loginWrapper}>
            <div className={styles.loginCard}>
                <div className={styles.loginHeader}>
                    {/* Reuse admin/staff logo */}
                    <img src="/images/head.png" alt="Staff" className={styles.loginLogo} />
                    <h1 className={styles.loginTitle}>Staff Panel</h1>
                    <p className={styles.loginSubtitle}>Sign in to continue</p>
                </div>
                <form onSubmit={handleSubmit} className={styles.loginForm}>
                    <div className={styles.inputGroup}>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder=" "
                            required
                            disabled={loading}
                        />
                        <label>Username</label>
                    </div>
                    <div className={styles.inputGroup}>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder=" "
                            required
                            disabled={loading}
                        />
                        <label>Password</label>
                    </div>
                    <button type="submit" className={styles.loginBtn} disabled={loading} style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' }}>
                        {loading ? 'Signing in...' : 'Sign in'}
                    </button>
                </form>
                {error && <p className={styles.loginError}>{error}</p>}
                <div className={styles.loginFooter}>
                    <span className={styles.loginFooterText}>KSK VASU & Co - Staff Access</span>
                </div>
            </div>
        </div>
    );
}

export default StaffLogin;
