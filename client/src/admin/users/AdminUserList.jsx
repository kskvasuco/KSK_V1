import React, { useState, useEffect } from 'react';
import adminApi from '../adminApi';
import styles from '../adminStyles.module.css';
import AdminPasswordModal from '../components/AdminPasswordModal';
import UserDetailModal from '../components/UserDetailModal';

export default function AdminUserList() {
    const [viewMode, setViewMode] = useState('visited'); // 'visited' or 'ordered'
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Detail Modal State
    const [selectedUser, setSelectedUser] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');

    // Password Modal State
    const [passwordModal, setPasswordModal] = useState({
        show: false,
        action: null, // { type: 'block'|'delete', user }
        title: '',
        message: ''
    });

    useEffect(() => {
        fetchUsers();
    }, [viewMode]);

    const fetchUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            let data;
            if (viewMode === 'visited') {
                data = await adminApi.getUsers();
            } else {
                data = await adminApi.getAllUsers();
            }
            setUsers(data || []);
        } catch (err) {
            console.error('Error fetching users:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleBlockAction = (user) => {
        const isBlocking = !user.isBlocked;
        setPasswordModal({
            show: true,
            action: { type: 'block', user, isBlocking },
            title: isBlocking ? 'Block User' : 'Unblock User',
            message: `Are you sure you want to ${isBlocking ? 'block' : 'unblock'} ${user.name || 'this user'}?`
        });
    };

    const handleDeleteAction = (user) => {
        setPasswordModal({
            show: true,
            action: { type: 'delete', user },
            title: 'Delete User',
            message: `Are you absolutely sure you want to delete ${user.name || 'this user'}? This action cannot be undone.`
        });
    };

    const handleConfirmPassword = async () => {
        const { action } = passwordModal;
        try {
            if (action.type === 'block') {
                await adminApi.blockUser(action.user._id, action.isBlocking);
                setUsers(prev => prev.map(u =>
                    u._id === action.user._id ? { ...u, isBlocked: action.isBlocking } : u
                ));
            } else if (action.type === 'delete') {
                await adminApi.deleteUser(action.user._id);
                setUsers(prev => prev.filter(u => u._id !== action.user._id));
            }
            setPasswordModal({ show: false, action: null });
        } catch (err) {
            alert(err.message);
        }
    };

    const handleCreateOrder = (userId) => {
        window.location.href = `/admin/create-order?userId=${userId}`;
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
                            className={`${styles.userCard} ${user.isBlocked ? styles.blockedCard : ''}`}
                            onClick={() => {
                                setSelectedUser(user);
                                setShowDetailModal(true);
                            }}
                            style={{ cursor: 'pointer' }}
                        >
                            <div className={styles.userCardHeader}>
                                <div>
                                    <strong>{user.name || 'Customer'}</strong>
                                    {user.isBlocked && (
                                        <span style={{
                                            marginLeft: '10px',
                                            fontSize: '10px',
                                            backgroundColor: '#dc3545',
                                            color: '#fff',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            textTransform: 'uppercase'
                                        }}>
                                            Blocked
                                        </span>
                                    )}
                                </div>
                                <span className={styles.mobileBadge}>{user.mobile}</span>
                            </div>
                            <div className={styles.userCardBody}>
                                {user.email && <p><strong>Email:</strong> {user.email}</p>}
                                <p><strong>Address:</strong> {user.address || 'N/A'}</p>
                                <p><strong>Region:</strong> {user.district}, {user.taluk} - {user.pincode}</p>

                                <div style={{ marginTop: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    <button
                                        className={styles.btnAddOrder}
                                        style={{ flex: '1 1 100%', padding: '8px', fontSize: '13px', marginBottom: '5px' }}
                                        onClick={(e) => { e.stopPropagation(); handleCreateOrder(user._id); }}
                                    >
                                        Create Order
                                    </button>
                                    <button
                                        className={user.isBlocked ? styles.btnConfirm : styles.btnPause}
                                        style={{ flex: 1, padding: '6px', fontSize: '13px' }}
                                        onClick={(e) => { e.stopPropagation(); handleBlockAction(user); }}
                                    >
                                        {user.isBlocked ? 'Unblock' : 'Block'}
                                    </button>
                                    <button
                                        className={styles.btnCancel}
                                        style={{ flex: 1, padding: '6px', fontSize: '13px', backgroundColor: '#dc3545' }}
                                        onClick={(e) => { e.stopPropagation(); handleDeleteAction(user); }}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <AdminPasswordModal
                show={passwordModal.show}
                title={passwordModal.title}
                message={passwordModal.message}
                onConfirm={handleConfirmPassword}
                onCancel={() => setPasswordModal({ show: false, action: null })}
            />

            <UserDetailModal
                show={showDetailModal}
                user={selectedUser}
                isAdmin={true}
                onClose={() => setShowDetailModal(false)}
                onUpdate={fetchUsers}
            />
        </div>
    );
}
