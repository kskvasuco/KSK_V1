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
                body: JSON.stringify({ username: username.trim(), password: password.trim() }),
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

    const [showForgot, setShowForgot] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [step, setStep] = useState(1); // 1: Email, 2: OTP & New Pass
    const [resetMsg, setResetMsg] = useState('');
    const [resetError, setResetError] = useState('');
    const [otpTimer, setOtpTimer] = useState(0);

    // Countdown effect for OTP
    useEffect(() => {
        let interval = null;
        if (step === 2 && otpTimer > 0) {
            interval = setInterval(() => {
                setOtpTimer((prev) => prev - 1);
            }, 1000);
        } else if (otpTimer === 0) {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [step, otpTimer]);

    const formatTimer = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };


    const handleRequestOtp = async (e) => {
        e.preventDefault();
        setResetError('');
        setResetMsg('');
        setLoading(true);
        try {
            const res = await fetch('/api/admin/request-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: resetEmail.trim() }),
            });
            const data = await res.json();
            if (res.ok) {
                setStep(2);
                setResetMsg(data.message);
                setOtpTimer(300); // 5 minutes
            } else {

                setResetError(data.error);
            }
        } catch (err) {
            setResetError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setResetError('');
        setResetMsg('');
        setLoading(true);
        try {
            const res = await fetch('/api/admin/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: resetEmail.trim(), 
                    otp: otp.trim(), 
                    newPassword: newPassword.trim() 
                }),
            });
            const data = await res.json();
            if (res.ok) {
                alert('Password reset successful! Please login with your new password.');
                setShowForgot(false);
                setStep(1);
                setResetEmail('');
                setOtp('');
                setNewPassword('');
            } else {
                setResetError(data.error);
            }
        } catch (err) {
            setResetError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (showForgot) {
        return (
            <div className={styles.loginWrapper}>
                <div className={styles.loginCard}>
                    <div className={styles.loginHeader}>
                        <h1 className={styles.loginTitle}>Reset Password</h1>
                        <p className={styles.loginSubtitle}>
                            {step === 1 ? 'Enter your registered admin email' : 'Verify OTP and set new password'}
                        </p>
                    </div>
                    {step === 1 ? (
                        <form onSubmit={handleRequestOtp} className={styles.loginForm}>
                            <div className={styles.inputGroup}>
                                <input
                                    type="email"
                                    value={resetEmail}
                                    onChange={(e) => setResetEmail(e.target.value)}
                                    placeholder=""
                                    required
                                    disabled={loading}
                                />
                                <label>Registered Email</label>
                            </div>
                            <button type="submit" className={styles.loginBtn} disabled={loading}>
                                {loading ? 'Sending OTP...' : 'Send OTP'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleResetPassword} className={styles.loginForm}>
                            <div className={styles.inputGroup}>
                                <input
                                    type="text"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    placeholder=""
                                    required
                                    disabled={loading}
                                    maxLength="6"
                                />
                                <label>Enter 6-digit OTP</label>
                            </div>
                            {otpTimer > 0 ? (
                                <p style={{ fontSize: '12px', color: '#666', marginTop: '-10px', marginBottom: '15px' }}>
                                    OTP expires in: <span style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>{formatTimer(otpTimer)}</span>
                                </p>
                            ) : (
                                <p style={{ fontSize: '12px', color: '#dc3545', marginTop: '-10px', marginBottom: '15px', fontWeight: 'bold' }}>
                                    OTP has expired. Please request a new one.
                                </p>
                            )}
                            <div className={styles.inputGroup}>

                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder=""
                                    required
                                    disabled={loading}
                                />
                                <label>New Password</label>
                            </div>
                            <button type="submit" className={styles.loginBtn} disabled={loading || otpTimer === 0}>
                                {loading ? 'Resetting...' : 'Reset Password'}
                            </button>

                        </form>
                    )}
                    {resetMsg && <p style={{ color: '#28a745', fontSize: '14px', marginTop: '10px', textAlign: 'center' }}>{resetMsg}</p>}
                    {resetError && <p className={styles.loginError}>{resetError}</p>}
                    <div className={styles.loginFooter} style={{ marginTop: '20px' }}>
                        <button 
                            className={styles.linkBtn} 
                            onClick={() => { setShowForgot(false); setStep(1); }}
                            style={{ background: 'none', border: 'none', color: '#0d6efd', cursor: 'pointer', fontSize: '14px' }}
                        >
                            Back to Login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

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
                            onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                            onKeyDown={(e) => {
                                if (e.key === ' ') e.preventDefault();
                            }}
                            placeholder=""
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
                            placeholder=""
                            required
                            disabled={loading}
                        />
                        <label>Password</label>
                    </div>
                    <div style={{ textAlign: 'right', marginBottom: '20px', marginTop: '-10px' }}>
                        <button 
                            type="button" 
                            className={styles.linkBtn} 
                            onClick={() => setShowForgot(true)}
                            style={{ background: 'none', border: 'none', color: '#0d6efd', cursor: 'pointer', fontSize: '13px' }}
                        >
                            Forgot Password?
                        </button>
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
