import React, { useState, useEffect } from 'react';
import adminApi from './adminApi';
import AdminPasswordModal from './components/AdminPasswordModal';
import { useOrderStream } from './hooks/useOrderStream';
import styles from './adminStyles.module.css';

export default function Settings() {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showPasswordModal, setShowPasswordModal] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const [otpTimer, setOtpTimer] = useState(0);

    // Admin Login OTP State
    const [showOtpSection, setShowOtpSection] = useState(false);
    const [otpStep, setOtpStep] = useState(1);
    const [otpCode, setOtpCode] = useState('');
    const [newLoginPass, setNewLoginPass] = useState('');
    const [otpEmail, setOtpEmail] = useState('');
    const [otpError, setOtpError] = useState('');
    const [otpMsg, setOtpMsg] = useState('');

    // Profile OTP State
    const [showProfileOtpSection, setShowProfileOtpSection] = useState(false);
    const [profileOtpStep, setProfileOtpStep] = useState(1);
    const [profileOtpCode, setProfileOtpCode] = useState('');
    const [newProfilePass, setNewProfilePass] = useState('');
    const [profileOtpEmail, setProfileOtpEmail] = useState('');
    const [profileOtpError, setProfileOtpError] = useState('');
    const [profileOtpMsg, setProfileOtpMsg] = useState('');
    const [profileOtpTimer, setProfileOtpTimer] = useState(0);

    // Username OTP State
    const [showUsernameOtpSection, setShowUsernameOtpSection] = useState(false);
    const [usernameOtpStep, setUsernameOtpStep] = useState(1);
    const [usernameOtpCode, setUsernameOtpCode] = useState('');
    const [newUsernameInput, setNewUsernameInput] = useState('');
    const [usernameOtpEmail, setUsernameOtpEmail] = useState('');
    const [usernameOtpError, setUsernameOtpError] = useState('');
    const [usernameOtpMsg, setUsernameOtpMsg] = useState('');
    const [usernameOtpTimer, setUsernameOtpTimer] = useState(0);

    useEffect(() => {
        let interval = null;
        if (otpStep === 2 && otpTimer > 0) {
            interval = setInterval(() => {
                setOtpTimer((prev) => prev - 1);
            }, 1000);
        } else if (otpTimer === 0) {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [otpStep, otpTimer]);

    useEffect(() => {
        let interval = null;
        if (profileOtpStep === 2 && profileOtpTimer > 0) {
            interval = setInterval(() => {
                setProfileOtpTimer((prev) => prev - 1);
            }, 1000);
        } else if (profileOtpTimer === 0) {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [profileOtpStep, profileOtpTimer]);

    useEffect(() => {
        let interval = null;
        if (usernameOtpStep === 2 && usernameOtpTimer > 0) {
            interval = setInterval(() => {
                setUsernameOtpTimer((prev) => prev - 1);
            }, 1000);
        } else if (usernameOtpTimer === 0) {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [usernameOtpStep, usernameOtpTimer]);

    const formatTimer = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };



    const fetchSettings = async () => {
        setLoading(true);
        try {
            const data = await adminApi.getAppController();
            setSettings(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordVerified = () => {
        setShowPasswordModal(false);
        fetchSettings();
    };

    useOrderStream((type) => {
        if (type === 'settings_updated') {
            fetchSettings();
        }
    }, !showPasswordModal);

    const toggleSetting = async (field) => {
        if (!settings || isSaving) return;

        const updatedValue = !settings[field];
        setIsSaving(true);
        
        try {
            const result = await adminApi.updateAppController({ [field]: updatedValue });
            setSettings(result);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            alert(`Failed to update setting: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleRequestOtp = async (e) => {
        e.preventDefault();
        setOtpError('');
        setOtpMsg('');
        setIsSaving(true);
        try {
            const res = await adminApi.requestOtp(otpEmail.trim());
            setOtpMsg(res.message);
            setOtpStep(2);
            setOtpTimer(300); // 5 minutes

        } catch (err) {
            setOtpError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setOtpError('');
        setOtpMsg('');
        setIsSaving(true);
        try {
            await adminApi.resetPassword(otpEmail.trim(), otpCode.trim(), newLoginPass.trim());
            setSaveSuccess(true);
            setShowOtpSection(false);
            setOtpStep(1);
            setOtpCode('');
            setNewLoginPass('');
            setOtpEmail('');
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            setOtpError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleRequestProfileOtp = async (e) => {
        e.preventDefault();
        setProfileOtpError('');
        setProfileOtpMsg('');
        setIsSaving(true);
        try {
            const res = await adminApi.requestOtp(profileOtpEmail.trim());
            setProfileOtpMsg(res.message);
            setProfileOtpStep(2);
            setProfileOtpTimer(300); // 5 minutes
        } catch (err) {
            setProfileOtpError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetProfilePassword = async (e) => {
        e.preventDefault();
        setProfileOtpError('');
        setProfileOtpMsg('');
        setIsSaving(true);
        try {
            await adminApi.resetProfilePassword(profileOtpEmail.trim(), profileOtpCode.trim(), newProfilePass.trim());
            setSaveSuccess(true);
            setShowProfileOtpSection(false);
            setProfileOtpStep(1);
            setProfileOtpCode('');
            setNewProfilePass('');
            setProfileOtpEmail('');
            setTimeout(() => setSaveSuccess(false), 3000);
            fetchSettings(); // Refresh settings to show updated status
        } catch (err) {
            setProfileOtpError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleRequestUsernameOtp = async (e) => {
        e.preventDefault();
        setUsernameOtpError('');
        setUsernameOtpMsg('');
        setIsSaving(true);
        try {
            const res = await adminApi.requestOtp(usernameOtpEmail.trim());
            setUsernameOtpMsg(res.message);
            setUsernameOtpStep(2);
            setUsernameOtpTimer(300); // 5 minutes
        } catch (err) {
            setUsernameOtpError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetUsername = async (e) => {
        e.preventDefault();
        setUsernameOtpError('');
        setUsernameOtpMsg('');
        setIsSaving(true);
        try {
            await adminApi.resetUsername(usernameOtpEmail.trim(), usernameOtpCode.trim(), newUsernameInput.trim());
            setSaveSuccess(true);
            setShowUsernameOtpSection(false);
            setUsernameOtpStep(1);
            setUsernameOtpCode('');
            setNewUsernameInput('');
            setUsernameOtpEmail('');
            setTimeout(() => setSaveSuccess(false), 3000);
            fetchSettings(); // Refresh settings to show updated status
        } catch (err) {
            setUsernameOtpError(err.message);
        } finally {
            setIsSaving(false);
        }
    };


    if (showPasswordModal) {
        return (
            <AdminPasswordModal
                show={showPasswordModal}
                onCancel={() => window.history.back()}
                onConfirm={handlePasswordVerified}
            />
        );
    }

    if (loading) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner}></div>
                <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Fetching configurations...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.errorContainer}>
                <p>⚠️ {error}</p>
                <button onClick={fetchSettings} className={styles.btnEditSmall} style={{ marginTop: '12px' }}>
                    Try Again
                </button>
            </div>
        );
    }

    if (!settings) return null;

    return (
        <div className={styles.controllerPage}>
            <div className={styles.controllerHeader}>
                <h2 className={styles.pageTitle}>App Settings</h2>
                <p className={styles.pageSubtitle}>Manage global settings and secure actions.</p>
            </div>

            <div className={styles.controllerGrid}>
                {/* Admin Charges Toggle */}
                <div className={styles.controllerCard}>
                    <div className={styles.controllerIcon}>🛡️</div>
                    <div className={styles.controllerInfo}>
                        <h3>Admin Charges</h3>
                        <p>Enable or disable the capability to add extra charges in the Admin panel.</p>
                    </div>
                    <div className={styles.toggleWrapper}>
                        <label className={styles.switch}>
                            <input
                                type="checkbox"
                                checked={settings.isChargesEnabledAdmin}
                                onChange={() => toggleSetting('isChargesEnabledAdmin')}
                                disabled={isSaving}
                            />
                            <span className={`${styles.slider} ${styles.round}`}></span>
                        </label>
                        <span className={styles.toggleStatus}>
                            {settings.isChargesEnabledAdmin ? 'Enabled' : 'Disabled'}
                        </span>
                    </div>
                </div>

                {/* Staff Charges Toggle */}
                <div className={styles.controllerCard}>
                    <div className={styles.controllerIcon}>👥</div>
                    <div className={styles.controllerInfo}>
                        <h3>Staff Charges</h3>
                        <p>Enable or disable the capability to add extra charges in the Staff panel.</p>
                    </div>
                    <div className={styles.toggleWrapper}>
                        <label className={styles.switch}>
                            <input
                                type="checkbox"
                                checked={settings.isChargesEnabledStaff}
                                onChange={() => toggleSetting('isChargesEnabledStaff')}
                                disabled={isSaving}
                            />
                            <span className={`${styles.slider} ${styles.round}`}></span>
                        </label>
                        <span className={styles.toggleStatus}>
                            {settings.isChargesEnabledStaff ? 'Enabled' : 'Disabled'}
                        </span>
                    </div>
                </div>

                {/* Action Password Setting */}
                <div className={styles.controllerCard} style={{ gridColumn: '1 / -1', alignItems: 'flex-start' }}>
                    <div className={styles.controllerIcon}>🔑</div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div className={styles.controllerInfo}>
                            <h3>Profile Password</h3>
                            <p>Change the password required for sensitive actions (like deleting or editing orders). {settings.profilePassword ? "A custom password is currently set." : "Using system default password."}</p>
                        </div>
                        
                        {!showProfileOtpSection ? (
                            <button 
                                onClick={() => { setShowProfileOtpSection(true); setProfileOtpEmail(''); setProfileOtpStep(1); }} 
                                className={styles.btnEditSmall}
                                style={{ width: 'fit-content' }}
                            >
                                Reset via OTP
                            </button>
                        ) : (
                            <div style={{ width: '100%', maxWidth: '450px', background: '#f0f7ff', padding: '15px', borderRadius: '8px', border: '1px solid #cde4ff' }}>
                                {profileOtpStep === 1 ? (
                                    <form onSubmit={handleRequestProfileOtp} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#0056b3' }}>Step 1: Enter Registered Email</label>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <input 
                                                type="email"
                                                placeholder="admin@example.com"
                                                value={profileOtpEmail}
                                                onChange={(e) => setProfileOtpEmail(e.target.value)}
                                                className={styles.modalInput}
                                                style={{ flex: 1, margin: 0 }}
                                                required
                                            />
                                            <button type="submit" className={styles.btnConfirm} disabled={isSaving}>
                                                Send OTP
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <form onSubmit={handleResetProfilePassword} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#0056b3' }}>Step 2: Verify OTP & Set New Profile Password</label>
                                        <input 
                                            type="text"
                                            placeholder="6-digit OTP"
                                            value={profileOtpCode}
                                            onChange={(e) => setProfileOtpCode(e.target.value)}
                                            className={styles.modalInput}
                                            style={{ margin: 0 }}
                                            maxLength="6"
                                            required
                                        />
                                        {profileOtpTimer > 0 ? (
                                            <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
                                                OTP expires in: <span style={{ fontWeight: 'bold', color: '#ff9800' }}>{formatTimer(profileOtpTimer)}</span>
                                            </p>
                                        ) : (
                                            <p style={{ fontSize: '12px', color: '#dc3545', margin: 0, fontWeight: 'bold' }}>
                                                OTP has expired. Please request a new one.
                                            </p>
                                        )}
                                        <input 
                                            type="password"
                                            placeholder="New Profile Password"
                                            value={newProfilePass}
                                            onChange={(e) => setNewProfilePass(e.target.value)}
                                            className={styles.modalInput}
                                            style={{ margin: 0 }}
                                            required
                                        />
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button type="submit" className={styles.btnConfirm} style={{ flex: 1 }} disabled={isSaving || profileOtpTimer === 0}>
                                                Update Password
                                            </button>
                                            <button type="button" onClick={() => setProfileOtpStep(1)} className={styles.btnCancel} disabled={isSaving}>
                                                Back
                                            </button>
                                        </div>
                                    </form>
                                )}
                                {profileOtpMsg && <p style={{ color: '#28a745', fontSize: '12px', marginTop: '8px' }}>{profileOtpMsg}</p>}
                                {profileOtpError && <p style={{ color: '#dc3545', fontSize: '12px', marginTop: '8px' }}>{profileOtpError}</p>}
                                <button 
                                    onClick={() => setShowProfileOtpSection(false)} 
                                    style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '12px', marginTop: '10px', textDecoration: 'underline' }}
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Admin Username Reset (via OTP) */}
                <div className={styles.controllerCard} style={{ gridColumn: '1 / -1', alignItems: 'flex-start', borderTop: '1px solid #eee', paddingTop: '20px', marginTop: '10px' }}>
                    <div className={styles.controllerIcon}>👤</div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div className={styles.controllerInfo}>
                            <h3>Admin Username</h3>
                            <p>Reset the main admin login username using OTP verification. OTP will be sent to your registered email.</p>
                        </div>
                        
                        {!showUsernameOtpSection ? (
                            <button 
                                onClick={() => { setShowUsernameOtpSection(true); setUsernameOtpEmail(''); setUsernameOtpStep(1); }} 
                                className={styles.btnEditSmall}
                                style={{ width: 'fit-content' }}
                            >
                                Reset via OTP
                            </button>
                        ) : (
                            <div style={{ width: '100%', maxWidth: '450px', background: '#fff9e6', padding: '15px', borderRadius: '8px', border: '1px solid #ffeeba' }}>
                                {usernameOtpStep === 1 ? (
                                    <form onSubmit={handleRequestUsernameOtp} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#856404' }}>Step 1: Enter Registered Email</label>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <input 
                                                type="email"
                                                placeholder="admin@example.com"
                                                value={usernameOtpEmail}
                                                onChange={(e) => setUsernameOtpEmail(e.target.value)}
                                                className={styles.modalInput}
                                                style={{ flex: 1, margin: 0 }}
                                                required
                                            />
                                            <button type="submit" className={styles.btnConfirm} disabled={isSaving}>
                                                Send OTP
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <form onSubmit={handleResetUsername} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#856404' }}>Step 2: Verify OTP & Set New Username</label>
                                        <input 
                                            type="text"
                                            placeholder="6-digit OTP"
                                            value={usernameOtpCode}
                                            onChange={(e) => setUsernameOtpCode(e.target.value)}
                                            className={styles.modalInput}
                                            style={{ margin: 0 }}
                                            maxLength="6"
                                            required
                                        />
                                        {usernameOtpTimer > 0 ? (
                                            <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
                                                OTP expires in: <span style={{ fontWeight: 'bold', color: '#ff9800' }}>{formatTimer(usernameOtpTimer)}</span>
                                            </p>
                                        ) : (
                                            <p style={{ fontSize: '12px', color: '#dc3545', margin: 0, fontWeight: 'bold' }}>
                                                OTP has expired. Please request a new one.
                                            </p>
                                        )}
                                        <input 
                                            type="text"
                                            placeholder="New Admin Username"
                                            value={newUsernameInput}
                                            onChange={(e) => setNewUsernameInput(e.target.value)}
                                            className={styles.modalInput}
                                            style={{ margin: 0 }}
                                            required
                                        />
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button type="submit" className={styles.btnConfirm} style={{ flex: 1 }} disabled={isSaving || usernameOtpTimer === 0}>
                                                Reset Username
                                            </button>
                                            <button type="button" onClick={() => setUsernameOtpStep(1)} className={styles.btnCancel} disabled={isSaving}>
                                                Back
                                            </button>
                                        </div>
                                    </form>
                                )}
                                {usernameOtpMsg && <p style={{ color: '#28a745', fontSize: '12px', marginTop: '8px' }}>{usernameOtpMsg}</p>}
                                {usernameOtpError && <p style={{ color: '#dc3545', fontSize: '12px', marginTop: '8px' }}>{usernameOtpError}</p>}
                                <button 
                                    onClick={() => setShowUsernameOtpSection(false)} 
                                    style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '12px', marginTop: '10px', textDecoration: 'underline' }}
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Login Password Reset (via OTP) */}
                <div className={styles.controllerCard} style={{ gridColumn: '1 / -1', alignItems: 'flex-start', borderTop: '1px solid #eee', paddingTop: '20px', marginTop: '10px' }}>
                    <div className={styles.controllerIcon}>📧</div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div className={styles.controllerInfo}>
                            <h3>Admin Login Password</h3>
                            <p>Reset the main admin login password using OTP verification. OTP will be sent to your registered email.</p>
                        </div>
                        
                        {!showOtpSection ? (
                            <button 
                                onClick={() => { setShowOtpSection(true); setOtpEmail(''); setOtpStep(1); }} 
                                className={styles.btnEditSmall}
                                style={{ width: 'fit-content' }}
                            >
                                Reset via OTP
                            </button>
                        ) : (
                            <div style={{ width: '100%', maxWidth: '450px', background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #ddd' }}>
                                {otpStep === 1 ? (
                                    <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Step 1: Enter Registered Email</label>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <input 
                                                type="email"
                                                placeholder="admin@example.com"
                                                value={otpEmail}
                                                onChange={(e) => setOtpEmail(e.target.value)}
                                                className={styles.modalInput}
                                                style={{ flex: 1, margin: 0 }}
                                                required
                                            />
                                            <button type="submit" className={styles.btnConfirm} disabled={isSaving}>
                                                Send OTP
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Step 2: Verify OTP & Set New Password</label>
                                        <input 
                                            type="text"
                                            placeholder="6-digit OTP"
                                            value={otpCode}
                                            onChange={(e) => setOtpCode(e.target.value)}
                                            className={styles.modalInput}
                                            style={{ margin: 0 }}
                                            maxLength="6"
                                            required
                                        />
                                        {otpTimer > 0 ? (
                                            <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
                                                OTP expires in: <span style={{ fontWeight: 'bold', color: '#ff9800' }}>{formatTimer(otpTimer)}</span>
                                            </p>
                                        ) : (
                                            <p style={{ fontSize: '12px', color: '#dc3545', margin: 0, fontWeight: 'bold' }}>
                                                OTP has expired. Please request a new one.
                                            </p>
                                        )}
                                        <input 
                                            type="password"
                                            placeholder="New Login Password"
                                            value={newLoginPass}
                                            onChange={(e) => setNewLoginPass(e.target.value)}
                                            className={styles.modalInput}
                                            style={{ margin: 0 }}
                                            required
                                        />
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button type="submit" className={styles.btnConfirm} style={{ flex: 1 }} disabled={isSaving || otpTimer === 0}>
                                                Reset Password
                                            </button>

                                            <button type="button" onClick={() => setOtpStep(1)} className={styles.btnCancel} disabled={isSaving}>
                                                Back
                                            </button>
                                        </div>
                                    </form>
                                )}
                                {otpMsg && <p style={{ color: '#28a745', fontSize: '12px', marginTop: '8px' }}>{otpMsg}</p>}
                                {otpError && <p style={{ color: '#dc3545', fontSize: '12px', marginTop: '8px' }}>{otpError}</p>}
                                <button 
                                    onClick={() => setShowOtpSection(false)} 
                                    style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '12px', marginTop: '10px', textDecoration: 'underline' }}
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {saveSuccess && (
                <div className={styles.saveSuccessToast}>
                    <span>✅ Settings updated successfully</span>
                </div>
            )}

            {isSaving && (
                <div className={styles.savingOverlay}>
                    <div className={styles.loadingSpinner}></div>
                    <p>{showOtpSection ? 'Processing OTP...' : 'Saving Changes...'}</p>
                </div>
            )}

        </div>
    );
}
