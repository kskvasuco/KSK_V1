import React, { useState, useEffect } from 'react';
import staffApi from '../staffApi';
import styles from '../../admin/adminStyles.module.css';
import UserDetailModal from '../../admin/components/UserDetailModal';

export default function StaffUserList() {
    const [viewMode, setViewMode] = useState('visited'); // 'visited' or 'ordered'
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');

    // Detail Modal State
    const [selectedUser, setSelectedUser] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

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

    const filteredUsers = users.filter(user => {
        const query = searchQuery.toLowerCase();
        return (
            (user.name && user.name.toLowerCase().includes(query)) ||
            (user.mobile && user.mobile.includes(query)) ||
            (user.email && user.email.toLowerCase().includes(query)) ||
            (user.district && user.district.toLowerCase().includes(query)) ||
            (user.taluk && user.taluk.toLowerCase().includes(query)) ||
            (user.pincode && user.pincode.includes(query))
        );
    });

    return (
        <div className={styles.adminSection}>
            <div className={styles.sectionHeader} style={{ justifyContent: 'flex-start' }}>
                <div className={styles.toggleButtons}>
                    <button
                        className={`${styles.toggleBtn} ${viewMode === 'visited' ? styles.active : ''}`}
                        onClick={() => setViewMode('visited')}
                    >
                        Visited Users {viewMode === 'visited' && `(${users.length})`}
                    </button>
                    <button
                        className={`${styles.toggleBtn} ${viewMode === 'ordered' ? styles.active : ''}`}
                        onClick={() => setViewMode('ordered')}
                    >
                        Ordered Users {viewMode === 'ordered' && `(${users.length})`}
                    </button>
                </div>
            </div>

            <div className={styles.searchContainer}>
                <input
                    type="text"
                    placeholder="Search users by name, mobile, email, or region..."
                    className={styles.searchInput}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
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

            {!loading && !error && filteredUsers.length === 0 && (
                <div className={styles.emptyState}>
                    <p>{searchQuery ? 'No users matching your search.' : 'No users found in this category.'}</p>
                </div>
            )}

            {!loading && !error && filteredUsers.length > 0 && (
                <div className={styles.userGrid}>
                    {filteredUsers.map(user => (
                        <div
                            key={user._id}
                            className={styles.userCard}
                            onClick={() => {
                                setSelectedUser(user);
                                setShowDetailModal(true);
                            }}
                            style={{ cursor: 'pointer' }}
                        >
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
                                        onClick={(e) => { e.stopPropagation(); handleCreateOrder(user._id); }}
                                    >
                                        Create New Order
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <UserDetailModal
                show={showDetailModal}
                user={selectedUser}
                isAdmin={false}
                onClose={() => setShowDetailModal(false)}
                onUpdate={fetchUsers}
            />
        </div>
    );
}
