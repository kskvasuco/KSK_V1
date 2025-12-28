import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './adminStyles.module.css';

function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Check if already logged in
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const res = await fetch('/api/admin/check', {
                    credentials: 'include'
                });
                if (res.ok) {
                    // Already authenticated, redirect to dashboard
                    navigate('/admin');
                }
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
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // Important: Include cookies
                body: JSON.stringify({ username, password }),
            });

            if (res.ok) {
                // Login successful, redirect to admin panel
                navigate('/admin');
            } else {
                const data = await res.json();
                setError(data.message || 'Invalid username or password');
            }
        } catch (err) {
            console.error('Login error:', err);
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.loginWrapper}>
            <div className={styles.loginCard}>
                <div className={styles.loginHeader}>
                    <img src="/images/head.png" alt="Admin" className={styles.loginLogo} />
                    <h1 className={styles.loginTitle}>Admin Panel</h1>
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
                    <button type="submit" className={styles.loginBtn} disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign in'}
                    </button>
                </form>
                {error && <p className={styles.loginError}>{error}</p>}
                <div className={styles.loginFooter}>
                    <span className={styles.loginFooterText}>KSK VASU & Co - Admin Access</span>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;
