import React, { useState, useEffect } from 'react';
import staffApi from '../staffApi';
import styles from '../../admin/adminStyles.module.css';

export default function StaffUserList() {
    const [viewMode, setViewMode] = useState('visited'); // 'visited' or 'all'
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchUsers();
    }, [viewMode]);

    const fetchUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            let data;
            if (viewMode === 'visited') {
                data = await staffApi.getUsers();
            } else {
                data = await staffApi.getAllUsers();
            }
            setUsers(data || []);
        } catch (err) {
            console.error('Error fetching users:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateOrder = (userId) => {
        // Logic to navigate to create order page for this user
        // For now, we'll just log it
        console.log('Create order for:', userId);
        // Navigate to /staff/create-order?userId=...
        window.location.href = `/staff/create-order?userId=${userId}`;
    };

    return (
        <div className={styles.adminSection}>
            <div className={styles.sectionHeader}>
                <h3>User Management</h3>
                <div className={styles.toggleButtons}>
                    <button
                        className={`${styles.toggleBtn} ${viewMode === 'visited' ? styles.active : ''}`}
                        onClick={() => setViewMode('visited')}
                    >
                        Visited Users {viewMode === 'visited' && `(${users.length})`}
                    </button>
                    <button
                        className={`${styles.toggleBtn} ${viewMode === 'all' ? styles.active : ''}`}
                        onClick={() => setViewMode('all')}
                    >
                        All Users {viewMode === 'all' && `(${users.length})`}
                    </button>
                </div>
            </div>

            {loading && (
                <div className={styles.loadingContainer}>
                    <div className={styles.loadingSpinner}></div>
                    <p>Loading users...</p>
                </div>
            )}

            {error && (
                <div className={styles.errorMessage}>
                    <p>Error: {error}</p>
                    <button onClick={fetchUsers}>Retry</button>
                </div>
            )}

            {!loading && !error && users.length === 0 && (
                <div className={styles.emptyState}>
                    <p>No users found in this category.</p>
                </div>
            )}

            {!loading && !error && users.length > 0 && (
                <div className={styles.userGrid}>
                    {users.map(user => (
                        <div key={user._id} className={styles.userCard}>
                            <div className={styles.userCardHeader}>
                                <strong>{user.name || 'Customer'}</strong>
                                <span className={styles.mobileBadge}>{user.mobile}</span>
                            </div>
                            <div className={styles.userCardBody}>
                                {user.email && <p><strong>Email:</strong> {user.email}</p>}
                                <p><strong>Address:</strong> {user.address || 'N/A'}</p>
                                <p><strong>Region:</strong> {user.district}, {user.taluk} - {user.pincode}</p>

                                <div className={styles.userActions}>
                                    <button
                                        className={styles.btnAddOrder}
                                        onClick={() => handleCreateOrder(user._id)}
                                    >
                                        Create New Order
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
