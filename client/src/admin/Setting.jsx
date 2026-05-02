import React, { useState, useEffect } from 'react';
import adminApi from './adminApi';
import AdminPasswordModal from './components/AdminPasswordModal';
import { useOrderStream } from './hooks/useOrderStream';
import styles from './adminStyles.module.css';

export default function Setting() {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showPasswordModal, setShowPasswordModal] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');

    // OTP Reset State
    const [showOtpSection, setShowOtpSection] = useState(false);
    const [otpStep, setOtpStep] = useState(1); // 1: Email/Send, 2: Verify/Reset
    const [otpCode, setOtpCode] = useState('');
    const [newLoginPass, setNewLoginPass] = useState('');
    const [otpEmail, setOtpEmail] = useState('');
    const [otpError, setOtpError] = useState('');
    const [otpMsg, setOtpMsg] = useState('');


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

    const savePassword = async (e) => {
        e.preventDefault();
        if (!passwordInput || isSaving) return;
        setIsSaving(true);
        try {
            const result = await adminApi.updateAppController({ adminActionPassword: passwordInput });
            setSettings(result);
            setSaveSuccess(true);
            setPasswordInput('');
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            alert(`Failed to update password: ${err.message}`);
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
                            <h3>Admin Action Password</h3>
                            <p>Change the password required for sensitive actions (like deleting or editing orders). {settings.adminActionPassword ? "A custom password is currently set." : "Using system default password."}</p>
                        </div>
                        <form onSubmit={savePassword} style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '400px', alignItems: 'center' }}>
                            <input 
                                type="password"
                                placeholder="New Action Password"
                                value={passwordInput}
                                onChange={(e) => setPasswordInput(e.target.value)}
                                className={styles.modalInput}
                                style={{ flex: 1, margin: 0, padding: '8px 12px' }}
                                disabled={isSaving}
                            />
                            <button type="submit" className={styles.btnConfirm} disabled={!passwordInput || isSaving} style={{ whiteSpace: 'nowrap', padding: '9px 16px' }}>
                                Update
                            </button>
                        </form>
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
                                            <button type="submit" className={styles.btnConfirm} style={{ flex: 1 }} disabled={isSaving}>
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
