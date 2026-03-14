import React, { useState, useEffect } from 'react';
import adminApi from './adminApi';
import styles from './adminStyles.module.css';

const PaymentSettings = () => {
    const [settings, setSettings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentSetting, setCurrentSetting] = useState({ name: '', qrCode: '', type: 'bank', accountNumber: '', ifsc: '' });
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const data = await adminApi.getPaymentSettings();
            setSettings(data);
            setError(null);
        } catch (err) {
            setError('Failed to load payment settings');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCurrentSetting({ ...currentSetting, qrCode: reader.result });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (isEditing) {
                await adminApi.updatePaymentSetting(currentSetting._id, currentSetting);
            } else {
                await adminApi.createPaymentSetting(currentSetting);
            }
            setIsModalOpen(false);
            setCurrentSetting({ name: '', qrCode: '', type: 'bank', bankName: '', accountName: '', accountNumber: '', ifsc: '' });
            fetchSettings();
        } catch (err) {
            console.error('Full save error:', err);
            alert(`Failed to save payment setting: ${err.message}`);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this payment setting?')) {
            try {
                await adminApi.deletePaymentSetting(id);
                fetchSettings();
            } catch (err) {
                alert('Failed to delete payment setting');
                console.error(err);
            }
        }
    };

    const openModal = (setting = { name: '', qrCode: '', type: 'bank', bankName: '', accountName: '', accountNumber: '', ifsc: '' }) => {
        setCurrentSetting(setting);
        setIsEditing(!!setting._id);
        setIsModalOpen(true);
    };

    if (loading) return <div className={styles.loadingContainer}><div className={styles.loadingSpinner}></div></div>;

    const primarySettings = settings.filter(s => s.type === 'primary');
    const bankSettings = settings.filter(s => s.type === 'bank');

    return (
        <div className={styles.dashboard}>
            <div className={styles.sectionHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 className={styles.dashboardTitle}>Payment Settings</h2>
                <button className={styles.btnConfirm} onClick={() => openModal()}>+ Add Bank/QR</button>
            </div>

            {error && <div className={styles.errorMessage}>{error}</div>}

            <div className={styles.adminSection}>
                <h3>Primary Payment Methods (GPay/Paytm)</h3>
                <div className={styles.productGrid}>
                    {primarySettings.map(setting => (
                        <div key={setting._id} className={styles.productCard}>
                            <div style={{ padding: '20px', textAlign: 'center' }}>
                                <img src={setting.qrCode} alt={setting.name} style={{ width: '150px', height: '150px', objectFit: 'contain', marginBottom: '10px' }} />
                                <h4 style={{ margin: '10px 0' }}>{setting.name}</h4>
                                <div className={styles.orderActions}>
                                    <button className={styles.btnEdit} onClick={() => openModal(setting)}>Edit</button>
                                    <button className={styles.btnHold} onClick={() => handleDelete(setting._id)}>Delete</button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {primarySettings.length === 0 && <p className={styles.emptyState}>No primary settings found.</p>}
                </div>
            </div>

            <div className={styles.adminSection} style={{ marginTop: '40px' }}>
                <h3>Other Banks</h3>
                <div className={styles.productGrid}>
                    {bankSettings.map(setting => (
                        <div key={setting._id} className={styles.productCard}>
                            <div style={{ padding: '20px', textAlign: 'center' }}>
                                {setting.qrCode && <img src={setting.qrCode} alt={setting.name} style={{ width: '150px', height: '150px', objectFit: 'contain', marginBottom: '10px' }} />}
                                <h4 style={{ margin: '10px 0' }}>{setting.name}</h4>
                                {setting.accountName && <div style={{ fontSize: '14px', color: '#666' }}>A/C Name: {setting.accountName}</div>}
                                {setting.accountNumber && <div style={{ fontSize: '14px', color: '#666' }}>A/C: {setting.accountNumber}</div>}
                                {setting.ifsc && <div style={{ fontSize: '14px', color: '#666' }}>IFSC: {setting.ifsc}</div>}
                                <div className={styles.orderActions} style={{ marginTop: '15px' }}>
                                    <button className={styles.btnEdit} onClick={() => openModal(setting)}>Edit</button>
                                    <button className={styles.btnHold} onClick={() => handleDelete(setting._id)}>Delete</button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {bankSettings.length === 0 && <p className={styles.emptyState}>No bank settings found.</p>}
                </div>
            </div>

            {isModalOpen && (
                <div className={styles.modal}>
                    <div className={styles.modalContent}>
                        <h3>{isEditing ? 'Edit Payment Setting' : 'Add Payment Setting'}</h3>
                        <form onSubmit={handleSave}>
                            <div className={styles.inputGroup} style={{ marginBottom: '15px' }}>
                                <label style={{ position: 'static', transform: 'none', display: 'block', marginBottom: '5px' }}>Name (GPay, Paytm, HDFC, etc.)</label>
                                <input 
                                    type="text" 
                                    value={currentSetting.name} 
                                    onChange={(e) => setCurrentSetting({ ...currentSetting, name: e.target.value })} 
                                    required 
                                    placeholder=" "
                                />
                            </div>
                             <div className={styles.inputGroup} style={{ marginBottom: '15px' }}>
                                <label style={{ position: 'static', transform: 'none', display: 'block', marginBottom: '5px' }}>Account Name</label>
                                <input 
                                    type="text" 
                                    value={currentSetting.accountName || ''} 
                                    onChange={(e) => setCurrentSetting({ ...currentSetting, accountName: e.target.value })} 
                                    placeholder=" "
                                />
                            </div>
                            <div className={styles.inputGroup} style={{ marginBottom: '15px' }}>
                                <label style={{ position: 'static', transform: 'none', display: 'block', marginBottom: '5px' }}>Type</label>
                                <select 
                                    value={currentSetting.type} 
                                    onChange={(e) => setCurrentSetting({ ...currentSetting, type: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dadce0' }}
                                >
                                    <option value="bank">Bank</option>
                                    <option value="primary">Primary (GPay/Paytm)</option>
                                </select>
                            </div>
                            {currentSetting.type === 'bank' ? (
                                <>
                                    <div className={styles.inputGroup} style={{ marginBottom: '15px' }}>
                                        <label style={{ position: 'static', transform: 'none', display: 'block', marginBottom: '5px' }}>Account Number</label>
                                        <input 
                                            type="text" 
                                            value={currentSetting.accountNumber || ''} 
                                            onChange={(e) => setCurrentSetting({ ...currentSetting, accountNumber: e.target.value })} 
                                            placeholder="Enter Account Number"
                                        />
                                    </div>
                                    <div className={styles.inputGroup} style={{ marginBottom: '15px' }}>
                                        <label style={{ position: 'static', transform: 'none', display: 'block', marginBottom: '5px' }}>IFSC</label>
                                        <input 
                                            type="text" 
                                            value={currentSetting.ifsc || ''} 
                                            onChange={(e) => setCurrentSetting({ ...currentSetting, ifsc: e.target.value })} 
                                            placeholder="Enter IFSC Code"
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className={styles.inputGroup} style={{ marginBottom: '15px' }}>
                                    <label style={{ position: 'static', transform: 'none', display: 'block', marginBottom: '5px' }}>QR Code Image</label>
                                    <input type="file" accept="image/*" onChange={handleFileChange} required={!isEditing} />
                                    {currentSetting.qrCode && (
                                        <div style={{ marginTop: '10px', textAlign: 'center' }}>
                                            <img src={currentSetting.qrCode} alt="Preview" style={{ maxWidth: '100px' }} />
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className={styles.modalActions}>
                                <button type="button" className={styles.btnCancel} onClick={() => setIsModalOpen(false)}>Cancel</button>
                                <button type="submit" className={styles.btnConfirm}>Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaymentSettings;
