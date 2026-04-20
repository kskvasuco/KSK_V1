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
            </div>

            {saveSuccess && (
                <div className={styles.saveSuccessToast}>
                    <span>✅ Settings updated successfully</span>
                </div>
            )}

            {isSaving && (
                <div className={styles.savingOverlay}>
                    <div className={styles.loadingSpinner}></div>
                    <p>Saving Changes...</p>
                </div>
            )}
        </div>
    );
}
