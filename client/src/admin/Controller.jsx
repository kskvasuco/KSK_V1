import React, { useState, useEffect } from 'react';
import adminApi from './adminApi';
import AdminPasswordModal from './components/AdminPasswordModal';
import { useOrderStream } from './hooks/useOrderStream';
import styles from './adminStyles.module.css';

export default function Controller() {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showPasswordModal, setShowPasswordModal] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

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
                <h2 className={styles.pageTitle}>App Configuration Controller</h2>
                <p className={styles.pageSubtitle}>Manage global feature toggles for Admin and Staff panels.</p>
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
