import React, { useState } from 'react';
import styles from '../adminStyles.module.css';
import adminApi from '../adminApi';

export default function AdminPasswordModal({ show, onConfirm, onCancel, title = 'Verify Password', message = 'Please enter admin password to continue.' }) {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!show) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!password) {
            setError('Password is required');
            return;
        }

        setLoading(true);
        setError('');
        try {
            await adminApi.verifyPassword(password);
            setPassword('');
            onConfirm();
        } catch (err) {
            setError(err.message || 'Incorrect password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.modal} style={{ zIndex: 20000 }}>
            <div className={styles.modalContent} style={{ maxWidth: '400px' }}>
                <h3 style={{ marginBottom: '10px' }}>{title}</h3>
                <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>{message}</p>

                <form onSubmit={handleSubmit}>
                    <div className={styles.formGroup}>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password"
                            className={styles.modalInput}
                            autoFocus
                            disabled={loading}
                        />
                    </div>

                    {error && (
                        <p style={{ color: '#dc3545', fontSize: '13px', marginTop: '-10px', marginBottom: '15px' }}>
                            {error}
                        </p>
                    )}

                    <div className={styles.modalActions}>
                        <button
                            type="submit"
                            className={styles.btnConfirm}
                            disabled={loading}
                        >
                            {loading ? 'Verifying...' : 'Confirm'}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setPassword(''); setError(''); onCancel(); }}
                            className={styles.btnCancel}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
