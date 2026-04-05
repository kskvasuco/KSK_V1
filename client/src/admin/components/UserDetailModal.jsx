import React, { useState, useEffect } from 'react';
import styles from '../adminStyles.module.css';
import adminApi from '../adminApi';

export default function UserDetailModal({ show, user, onClose, isAdmin, onUpdate }) {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({});
    const [locations, setLocations] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || '',
                mobile: user.mobile || '',
                email: user.email || '',
                altMobile: user.altMobile || '',
                address: user.address || '',
                district: user.district || '',
                taluk: user.taluk || '',
                pincode: user.pincode || '',
            });
        }
    }, [user]);

    useEffect(() => {
        if (isEditing && !locations) {
            fetchLocations();
        }
    }, [isEditing]);

    useEffect(() => {
        if (!show) return;
        const onEsc = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onEsc);
        return () => document.removeEventListener('keydown', onEsc);
    }, [show, onClose]);

    const fetchLocations = async () => {
        try {
            const data = await adminApi.getLocations();
            setLocations(data);
        } catch (err) {
            console.error('Error fetching locations:', err);
        }
    };

    if (!show || !user) return null;

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (field === 'district') {
            setFormData(prev => ({ ...prev, taluk: '' })); // Reset taluk when district changes
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await adminApi.updateUser(user._id, formData);
            if (onUpdate) onUpdate();
            setIsEditing(false);
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.modal} style={{ zIndex: 1100 }} onClick={onClose}>
            <div className={styles.modalContent} style={{ maxWidth: '950px' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3>User Details</h3>
                    <button onClick={onClose} className={styles.closeMenuBtn} style={{ color: '#333', display: 'block' }}>✕</button>
                </div>

                {error && <div className={styles.errorMessage}>{error}</div>}

                {isEditing ? (
                    <form onSubmit={handleSave}>
                        <div className={styles.formGrid} style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                            <div className={styles.formGroup}>
                                <label>Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => handleInputChange('name', e.target.value)}
                                    className={styles.modalInput}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Mobile</label>
                                <input
                                    type="text"
                                    value={formData.mobile}
                                    disabled
                                    className={styles.modalInput}
                                    style={{ backgroundColor: '#f0f0f0' }}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => handleInputChange('email', e.target.value)}
                                    className={styles.modalInput}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Alt Mobile</label>
                                <input
                                    type="text"
                                    value={formData.altMobile}
                                    onChange={(e) => handleInputChange('altMobile', e.target.value)}
                                    className={styles.modalInput}
                                    maxLength="10"
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>District</label>
                                <select
                                    value={formData.district}
                                    onChange={(e) => handleInputChange('district', e.target.value)}
                                    className={styles.modalSelect}
                                >
                                    <option value="">Select District</option>
                                    {locations && Object.keys(locations).map(d => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Taluk</label>
                                <select
                                    value={formData.taluk}
                                    onChange={(e) => handleInputChange('taluk', e.target.value)}
                                    className={styles.modalSelect}
                                    disabled={!formData.district}
                                >
                                    <option value="">Select Taluk</option>
                                    {formData.district && locations?.[formData.district]?.map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Pincode</label>
                                <input
                                    type="text"
                                    value={formData.pincode}
                                    onChange={(e) => handleInputChange('pincode', e.target.value)}
                                    className={styles.modalInput}
                                    maxLength="6"
                                />
                            </div>
                            <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                                <label>Address</label>
                                <textarea
                                    value={formData.address}
                                    onChange={(e) => handleInputChange('address', e.target.value)}
                                    className={styles.modalTextarea}
                                    rows="2"
                                />
                            </div>
                        </div>

                        <div className={styles.modalActions}>
                            <button type="submit" className={styles.btnConfirm} disabled={loading}>
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                            <button type="button" onClick={() => setIsEditing(false)} className={styles.btnCancel}>
                                Cancel
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className={styles.userCardBody} style={{ padding: 0 }}>
                        <div className={styles.formGrid} style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                            <p><strong>Name:</strong> {user.name || 'N/A'}</p>
                            <p><strong>Mobile:</strong> {user.mobile}</p>
                            <p><strong>Email:</strong> {user.email || 'N/A'}</p>
                            <p><strong>Alt Mobile:</strong> {user.altMobile || 'N/A'}</p>
                            <p><strong>District:</strong> {user.district || 'N/A'}</p>
                            <p><strong>Taluk:</strong> {user.taluk || 'N/A'}</p>
                            <p><strong>Pincode:</strong> {user.pincode || 'N/A'}</p>
                            <p style={{ gridColumn: 'span 2' }}>
                                <strong>Address:</strong><br />
                                {user.address || 'N/A'}
                            </p>
                            <p><strong>Account Created:</strong> {new Date(user.createdAt).toLocaleDateString()}</p>
                            <p><strong>Status:</strong> {user.isBlocked ? 'Blocked' : 'Active'}</p>
                        </div>

                        <div className={styles.modalActions}>
                            {isAdmin && (
                                <button onClick={() => setIsEditing(true)} className={styles.btnEdit}>
                                    Edit Details
                                </button>
                            )}
                            <button onClick={onClose} className={styles.btnCancel}>
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
