import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import adminApi from '../adminApi';
import { formatPrice } from '../../utils/priceFormatter';
import styles from './adminOrderStyles.module.css';

export default function AdminCreateOrder() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const existingUserId = searchParams.get('userId');

    const [step, setStep] = useState(1); // 1: Select User, 2: Select Products, 3: Review & Submit
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Step 1: User Selection
    const [users, setUsers] = useState([]);
    const [userSearch, setUserSearch] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);

    // Step 2: Product Selection
    const [products, setProducts] = useState([]);
    const [productSearch, setProductSearch] = useState('');
    const [cart, setCart] = useState([]); // Array of { product, quantity, price }
    const [lastAddedId, setLastAddedId] = useState(null);
    const cartRefs = useRef({});
    
    // Order Date State
    const [orderDate, setOrderDate] = useState(() => {
        const localDate = new Date();
        const offset = localDate.getTimezoneOffset() * 60000;
        return new Date(localDate.getTime() - offset).toISOString().split('T')[0];
    });

    // Create User State
    // Create User State
    const [showCreateUserModal, setShowCreateUserModal] = useState(false);
    const [newUser, setNewUser] = useState({
        name: '', mobile: '', altMobile: '', email: '',
        address: '', taluk: '', district: '', pincode: ''
    });
    const [isEditingUser, setIsEditingUser] = useState(false);
    const [locations, setLocations] = useState({});
    const [creatingUser, setCreatingUser] = useState(false);
    const [validationError, setValidationError] = useState('');

    // Custom Product State
    const [showCustomProductForm, setShowCustomProductForm] = useState(false);
    const [customProduct, setCustomProduct] = useState({ name: '', price: '', quantity: '', unit: '' });

    // Initial Load
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                const [productsRes, locationsRes] = await Promise.all([
                    adminApi.getProducts(),
                    adminApi.getLocations() // Fetch locations
                ]);
                setProducts(productsRes.products || []);
                setLocations(locationsRes || {});

                if (existingUserId) {
                    const user = await adminApi.getUser(existingUserId);
                    if (user) {
                        setSelectedUser(user);
                        setStep(2);
                    }
                } else {
                    const allUsers = await adminApi.getAllUsers();
                    setUsers(allUsers);
                }
            } catch (err) {
                console.error("Init error:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [existingUserId]);

    // Focus and scroll when new item is added to cart
    useEffect(() => {
        if (lastAddedId && cartRefs.current[lastAddedId]) {
            cartRefs.current[lastAddedId].focus();
            cartRefs.current[lastAddedId].scrollIntoView({ behavior: 'smooth', block: 'center' });
            setLastAddedId(null);
        }
    }, [cart, lastAddedId]);

    const filteredUsers = users.filter(u =>
        u.mobile.includes(userSearch) ||
        (u.name && u.name.toLowerCase().includes(userSearch.toLowerCase()))
    );

    const filteredProducts = products.filter(p =>
        p.isVisible && (
            p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
            (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase()))
        )
    );

    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.product._id === product._id);
            if (existing) {
                setLastAddedId(product._id);
                return prev;
            }
            setLastAddedId(product._id);
            return [...prev, { product, quantity: product.isCustom ? product.quantity : '', price: product.price }];
        });
    };

    const handleAddCustomProduct = (e) => {
        if (e) e.preventDefault();
        if (!customProduct.name || !customProduct.price) {
            alert('Please fill name and price');
            return;
        }

        const newCustomProduct = {
            _id: `custom_${Date.now()}`,
            name: customProduct.name,
            price: parseFloat(customProduct.price),
            quantity: customProduct.quantity ? parseFloat(customProduct.quantity) : 0,
            unit: customProduct.unit || '',
            isCustom: true
        };

        addToCart(newCustomProduct);
        setShowCustomProductForm(false);
        setCustomProduct({ name: '', price: '', quantity: '', unit: '' });
    };

    const removeFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.product._id !== productId));
    };

    const updateCartItem = (productId, field, value) => {
        setCart(prev => prev.map(item => {
            if (item.product._id === productId) {
                if (value === '') {
                    return { ...item, [field]: '' };
                }
                return { ...item, [field]: parseFloat(value) || 0 };
            }
            return item;
        }));
    };

    const calculateTotal = () => {
        return cart.reduce((sum, item) => {
            const qty = (item.product.isCustom && (item.quantity === 0 || item.quantity === '')) ? 1 : (parseFloat(item.quantity) || 0);
            return sum + (qty * item.price);
        }, 0);
    };

    const handleUserInputChange = (e) => {
        const { name, value } = e.target;
        setNewUser(prev => ({ ...prev, [name]: value }));

        // Reset taluk when district changes
        if (name === 'district') {
            setNewUser(prev => ({ ...prev, taluk: '' }));
        }
        setValidationError(''); // Clear error on edit
    };

    const validateForm = () => {
        if (!newUser.name || !newUser.mobile) {
            return `Please fill required fields (Name and Mobile).`;
        }
        if (!/^\d{10}$/.test(newUser.mobile)) {
            return 'Mobile number must be exactly 10 digits.';
        }
        if (!/^[6-9]/.test(newUser.mobile)) {
            return 'Enter a Valid Mobile Number';
        }
        if (/^(\d)\1{9}$/.test(newUser.mobile)) {
            return 'Invalid mobile number.';
        }
        if (newUser.altMobile) {
            if (!/^\d{10}$/.test(newUser.altMobile)) {
                return 'Alternative mobile number must be exactly 10 digits.';
            }
            if (!/^[6-9]/.test(newUser.altMobile)) {
                return 'Enter a Valid Alternative Mobile Number';
            }
            if (/^(\d)\1{9}$/.test(newUser.altMobile)) {
                return 'Invalid alternative mobile number.';
            }
        }
        if (newUser.name.length > 50) {
            return 'Name must be 50 characters or less.';
        }
        if (newUser.email && !/\S+@\S+\.\S+/.test(newUser.email)) {
            return 'Please enter a valid email address.';
        }
        if (newUser.address && newUser.address.length > 250) {
            return 'Address must be 250 characters or less.';
        }
        if (newUser.pincode && !/^\d{6}$/.test(newUser.pincode)) {
            return 'Pincode must be exactly 6 digits.';
        }
        return null; // No errors
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setValidationError('');

        const errorMsg = validateForm();
        if (errorMsg) {
            setValidationError(errorMsg);
            return;
        }

        setCreatingUser(true);
        try {
            let updatedUser;
            if (isEditingUser) {
                // Update existing user
                const response = await adminApi.updateUser(selectedUser._id, newUser);
                updatedUser = response.user;
                
                // Update the users list so the change is reflected there too
                setUsers(prev => prev.map(u => u._id === updatedUser._id ? updatedUser : u));
                setSelectedUser(updatedUser);
            } else {
                // Create new user
                // Password logic: Set password same as mobile (for new users)
                const userData = { ...newUser, password: newUser.mobile };
                const response = await adminApi.createUser(userData);
                updatedUser = response.user;
                setUsers(prev => [updatedUser, ...prev]);
                setSelectedUser(updatedUser);
            }

            setShowCreateUserModal(false);
            setIsEditingUser(false);
            setNewUser({
                name: '', mobile: '', altMobile: '', email: '',
                address: '', taluk: '', district: '', pincode: ''
            });
            setStep(2);
        } catch (err) {
            console.error("User save error:", err);
            setValidationError(err.message || "Failed to save user");
        } finally {
            setCreatingUser(false);
        }
    };

    const handleSubmitOrder = async () => {
        if (!selectedUser || cart.length === 0) return;

        if (!window.confirm(`Create order for ${selectedUser.name || selectedUser.mobile} with ${cart.length} items? Total: ${formatPrice(calculateTotal())}`)) return;

        setLoading(true);
        try {
            const itemsPayload = cart.map(item => ({
                productId: item.product.isCustom ? null : item.product._id,
                quantity: item.quantity,
                price: item.price,
                isCustom: item.product.isCustom || false,
                name: item.product.isCustom ? item.product.name : undefined,
                unit: item.product.isCustom ? item.product.unit : undefined
            }));

            await adminApi.createOrderForUser(selectedUser._id, itemsPayload, orderDate);

            alert('Order created successfully!');
            navigate('/admin/pending');

        } catch (err) {
            console.error("Order creation error:", err);
            alert(`Failed to create order: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (loading && !products.length) return <div className={styles.loadingContainer}>Loading...</div>;

    const sortedDistricts = Object.keys(locations).sort();
    const taluks = newUser.district ? (locations[newUser.district] || []).sort() : [];

    return (
        <div className={styles.container}>
            <h3 className={styles.pageTitle}>Create New Order</h3>

            {/* Stepper */}
            <div className={styles.stepper}>
                <div className={`${styles.step} ${step >= 1 ? styles.active : ''} ${step > 1 ? styles.completed : ''}`}>
                    <div className={styles.stepCircle}>{step > 1 ? '✓' : '1'}</div>
                    <div className={styles.stepLabel}>Select User</div>
                </div>
                <div className={`${styles.step} ${step >= 2 ? styles.active : ''} ${step > 2 ? styles.completed : ''}`}>
                    <div className={styles.stepCircle}>{step > 2 ? '✓' : '2'}</div>
                    <div className={styles.stepLabel}>Add Products</div>
                </div>
                <div className={`${styles.step} ${step >= 3 ? styles.active : ''}`}>
                    <div className={styles.stepCircle}>3</div>
                    <div className={styles.stepLabel}>Review & Submit</div>
                </div>
            </div>

            {/* Step 1: User Selection */}
            {step === 1 && (
                <div>
                    <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                        <div className={styles.searchContainer} style={{ flex: 1, marginBottom: 0 }}>
                            <input
                                type="search"
                                placeholder="Search user by mobile or name..."
                                value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                                className={styles.searchInput}
                                autoFocus
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div className={styles.cartBadge} style={{ background: '#e8f0fe', color: '#1967d2', padding: '8px 15px', borderRadius: '20px', fontWeight: '600' }}>
                                🛒 Cart ({cart.length})
                            </div>
                            <button
                                className={`${styles.btn} ${styles.btnSuccess}`}
                                onClick={() => {
                                    setIsEditingUser(false);
                                    setNewUser({
                                        name: '', mobile: '', altMobile: '', email: '',
                                        address: '', taluk: '', district: '', pincode: ''
                                    });
                                    setShowCreateUserModal(true);
                                }}
                                style={{ whiteSpace: 'nowrap' }}
                            >
                                + Create New User
                            </button>
                        </div>
                    </div>

                    <div className={`${styles.grid} ${styles.userGrid}`}>
                        {filteredUsers.length === 0 && <p style={{ textAlign: 'center', color: '#888' }}>No users found matching "{userSearch}"</p>}
                        {filteredUsers.map(user => (
                            <div
                                key={user._id}
                                className={`${styles.card} ${selectedUser?._id === user._id ? styles.selected : ''}`}
                                onClick={() => { setSelectedUser(user); setCart([]); setStep(2); }}
                            >
                                <div className={styles.cardHeader}>
                                    <h4 className={styles.cardTitle}>{user.name || 'Customer'}</h4>
                                    <span className={styles.cardBadge}>{user.mobile}</span>
                                </div>
                                <div className={styles.cardBody}>
                                    <p className={styles.cardText} title={user.address}>{user.address || 'No address'}</p>
                                    <button className={`${styles.btn} ${styles.btnPrimary}`} style={{ marginTop: 'auto', width: '100%' }}>Select User</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Create User Modal */}
            {showCreateUserModal && (
                <div 
                    style={{
                        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        zIndex: 1000, padding: '20px'
                    }}
                    onClick={() => setShowCreateUserModal(false)}
                >
                    <div 
                        style={{ 
                            background: 'white', padding: '25px', borderRadius: '12px', width: '95%', maxWidth: '850px', 
                            boxShadow: '0 8px 32px rgba(0,0,0,0.3)', position: 'relative'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                            <h3 style={{ margin: 0, color: '#202124' }}>
                                {isEditingUser ? 'Edit User Profile' : 'Create New User'}
                            </h3>
                            <button 
                                type="button"
                                onClick={() => setShowCreateUserModal(false)}
                                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}
                            >
                                ×
                            </button>
                        </div>
                        <form onSubmit={handleCreateUser}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: '500', color: '#5f6368' }}>Name *</label>
                                    <input
                                        type="text"
                                        name="name"
                                        placeholder="Full Name"
                                        value={newUser.name}
                                        onChange={handleUserInputChange}
                                        maxLength="50"
                                        className={styles.modalInput}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: '500', color: '#5f6368' }}>Mobile *</label>
                                    <input
                                        type="text"
                                        name="mobile"
                                        placeholder="10-digit mobile"
                                        value={newUser.mobile}
                                        onChange={handleUserInputChange}
                                        maxLength="10"
                                        className={styles.modalInput}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: '500', color: '#5f6368' }}>Alt Mobile</label>
                                    <input
                                        type="text"
                                        name="altMobile"
                                        placeholder="Alternative mobile"
                                        value={newUser.altMobile}
                                        onChange={handleUserInputChange}
                                        maxLength="10"
                                        className={styles.modalInput}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: '500', color: '#5f6368' }}>District</label>
                                    <select
                                        name="district"
                                        value={newUser.district}
                                        onChange={handleUserInputChange}
                                        className={styles.modalSelect}
                                    >
                                        <option value="">Select District</option>
                                        {Object.keys(locations).sort().map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: '500', color: '#5f6368' }}>Taluk</label>
                                    <select
                                        name="taluk"
                                        value={newUser.taluk}
                                        onChange={handleUserInputChange}
                                        className={styles.modalSelect}
                                        disabled={!newUser.district}
                                    >
                                        <option value="">Select Taluk</option>
                                        {(newUser.district ? locations[newUser.district] || [] : []).sort().map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: '500', color: '#5f6368' }}>Pincode</label>
                                    <input
                                        type="text"
                                        name="pincode"
                                        placeholder="6-digit pincode"
                                        value={newUser.pincode}
                                        onChange={handleUserInputChange}
                                        maxLength="6"
                                        className={styles.modalInput}
                                    />
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: '500', color: '#5f6368' }}>Address</label>
                                    <textarea
                                        name="address"
                                        placeholder="Full Address"
                                        value={newUser.address}
                                        onChange={handleUserInputChange}
                                        className={styles.modalInput}
                                        style={{ height: '80px', resize: 'vertical', paddingTop: '10px' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: '500', color: '#5f6368' }}>Email</label>
                                    <input
                                        type="email"
                                        name="email"
                                        placeholder="Email Address"
                                        value={newUser.email}
                                        onChange={handleUserInputChange}
                                        className={styles.modalInput}
                                    />
                                </div>

                                {validationError && (
                                    <div style={{
                                        gridColumn: '1 / -1',
                                        color: '#d93025',
                                        fontSize: '13px',
                                        marginTop: '5px',
                                        fontWeight: '500',
                                        padding: '8px 12px',
                                        background: '#fce8e6',
                                        borderRadius: '4px'
                                    }}>
                                        {validationError}
                                    </div>
                                )}

                                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px', paddingTop: '15px', borderTop: '1px solid #eee' }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateUserModal(false)}
                                        className={`${styles.btn} ${styles.btnSecondary}`}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={creatingUser}
                                        className={`${styles.btn} ${styles.btnPrimary}`}
                                    >
                                        {creatingUser ? 'Saving...' : (isEditingUser ? 'Update Profile' : 'Create & Select')}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Step 2: Product Selection (Split Layout) */}
            {step === 2 && (
                <div className={styles.splitView}>
                    {/* Left: Product List */}
                    <div className={styles.productSection}>
                        <div style={{ marginBottom: '20px' }}>
                            <div className={styles.searchContainer} style={{ flex: 1, marginBottom: '15px' }}>
                                <input
                                    type="search"
                                    placeholder="Search products..."
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    className={styles.searchInput}
                                />
                            </div>

                            <div style={{
                                width: '100%',
                                border: '1.5px dashed #11998e',
                                borderRadius: '10px',
                                overflow: 'hidden',
                                backgroundColor: showCustomProductForm ? '#f0fdf9' : 'transparent',
                                marginBottom: '10px',
                                transition: 'all 0.3s ease'
                            }}>
                                <button
                                    onClick={() => {
                                        setShowCustomProductForm(prev => !prev);
                                        if (showCustomProductForm) {
                                            setCustomProduct({ name: '', quantity: '', price: '', unit: '' });
                                        }
                                    }}
                                    style={{
                                        width: '100%',
                                        background: showCustomProductForm
                                            ? 'linear-gradient(135deg, #11998e, #0d8a80)'
                                            : 'transparent',
                                        border: 'none',
                                        color: showCustomProductForm ? '#fff' : '#11998e',
                                        padding: '10px 16px',
                                        cursor: 'pointer',
                                        fontWeight: '700',
                                        fontSize: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '8px',
                                        letterSpacing: '0.3px',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <span>✦ Add Custom Product</span>
                                    <span style={{ fontSize: '18px', lineHeight: 1, fontWeight: '400' }}>
                                        {showCustomProductForm ? '×' : '+'}
                                    </span>
                                </button>

                                {showCustomProductForm && (
                                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            <div style={{ gridColumn: '1 / -1' }}>
                                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#064e3b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Product Name *</label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. Custom Steel Rods"
                                                    value={customProduct.name}
                                                    onChange={e => setCustomProduct(prev => ({ ...prev, name: e.target.value }))}
                                                    className={styles.modalInput}
                                                    style={{ marginBottom: 0, background: 'rgba(255,255,255,0.9)', border: '1.5px solid #a7f3d0' }}
                                                    autoFocus
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#064e3b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Quantity</label>
                                                <input
                                                    type="number"
                                                    placeholder="0"
                                                    min="0"
                                                    step="any"
                                                    value={customProduct.quantity}
                                                    onChange={e => setCustomProduct(prev => ({ ...prev, quantity: e.target.value }))}
                                                    className={styles.modalInput}
                                                    style={{ marginBottom: 0, background: 'rgba(255,255,255,0.9)', border: '1.5px solid #a7f3d0' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#064e3b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Price (₹) *</label>
                                                <input
                                                    type="number"
                                                    placeholder="0.00"
                                                    min="0"
                                                    step="any"
                                                    value={customProduct.price}
                                                    onChange={e => setCustomProduct(prev => ({ ...prev, price: e.target.value }))}
                                                    className={styles.modalInput}
                                                    style={{ marginBottom: 0, background: 'rgba(255,255,255,0.9)', border: '1.5px solid #a7f3d0' }}
                                                />
                                            </div>
                                            <div style={{ gridColumn: '1 / -1' }}>
                                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#064e3b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Unit (optional)</label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. kg, pcs, m"
                                                    value={customProduct.unit}
                                                    onChange={e => setCustomProduct(prev => ({ ...prev, unit: e.target.value }))}
                                                    className={styles.modalInput}
                                                    style={{ marginBottom: 0, background: 'rgba(255,255,255,0.9)', border: '1.5px solid #a7f3d0' }}
                                                />
                                            </div>
                                        </div>

                                        {customProduct.price && (
                                            <div style={{
                                                padding: '8px 12px',
                                                background: 'rgba(17,153,142,0.08)',
                                                borderRadius: '7px',
                                                fontSize: '13px',
                                                color: '#064e3b',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}>
                                                <span>Item Total:</span>
                                                <strong>₹{(() => {
                                                    const q = parseFloat(customProduct.quantity);
                                                    const p = parseFloat(customProduct.price || 0);
                                                    if (isNaN(q) || q === 0) return p.toFixed(2);
                                                    return (q * p).toFixed(2);
                                                })()}</strong>
                                            </div>
                                        )}

                                        <button
                                            onClick={handleAddCustomProduct}
                                            style={{
                                                background: 'linear-gradient(135deg, #11998e, #0d8a80)',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '8px',
                                                padding: '10px',
                                                fontWeight: '700',
                                                fontSize: '14px',
                                                cursor: 'pointer',
                                                width: '100%',
                                                transition: 'all 0.2s',
                                                boxShadow: '0 2px 8px rgba(17,153,142,0.3)'
                                            }}
                                        >
                                            ✓ Add to Cart
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className={`${styles.grid} ${styles.productGrid}`}>
                            {filteredProducts.map(product => {
                                const inCart = cart.find(c => c.product._id === product._id);
                                return (
                                    <div 
                                        key={product._id} 
                                        className={`${styles.card} ${inCart ? styles.selected : ''}`}
                                        onClick={() => addToCart(product)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {inCart && <div className={styles.addedBadge}>In Cart</div>}
                                        {product.image && (
                                            <img
                                                src={product.image}
                                                alt={product.name}
                                                className={styles.productThumbnail}
                                            />
                                        )}
                                        <div className={styles.cardBody}>
                                            <h4 className={styles.cardTitle} style={{ marginBottom: '5px' }}>{product.name}</h4>
                                            <div className={styles.cardText} style={{ fontSize: '0.85rem', marginBottom: '10px' }}>SKU: {product.sku || 'N/A'}</div>
                                            <div className={styles.productPrice}>{formatPrice(product.price)}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right: Cart Sidebar */}
                    <div className={styles.cartSection}>
                        <div className={styles.cartHeader}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h4>Cart ({cart.length})</h4>
                                <div 
                                    style={{ fontSize: '0.9rem', color: '#1a73e8', cursor: 'pointer', fontWeight: '500', textDecoration: 'underline' }}
                                    onClick={() => {
                                        setNewUser({
                                            name: selectedUser.name || '',
                                            mobile: selectedUser.mobile || '',
                                            altMobile: selectedUser.altMobile || '',
                                            email: selectedUser.email || '',
                                            address: selectedUser.address || '',
                                            taluk: selectedUser.taluk || '',
                                            district: selectedUser.district || '',
                                            pincode: selectedUser.pincode || ''
                                        });
                                        setIsEditingUser(true);
                                        setShowCreateUserModal(true);
                                    }}
                                    title="Edit User Profile"
                                >
                                    {selectedUser?.name || 'Customer'}
                                </div>
                            </div>
                        </div>
                        <div className={styles.cartBody}>
                            {cart.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#adb5bd' }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🛒</div>
                                    <p>Your cart is empty.<br />Select products to add.</p>
                                </div>
                            ) : (
                                cart.map((item, idx) => (
                                    <div key={idx} className={styles.cartItem}>
                                        <div className={styles.cartItemMain}>
                                            <div className={styles.cartItemName}>{item.product.name}</div>
                                            <button onClick={() => removeFromCart(item.product._id)} className={styles.btnRemove} title="Remove" style={{ color: '#d93025' }}>✕</button>
                                        </div>
                                        <div className={styles.cartControls}>
                                            <div className={styles.inputGroup}>
                                                <label className={styles.inputLabel}>Qty</label>
                                                <input
                                                    ref={el => cartRefs.current[item.product._id] = el}
                                                    type="number" min="0.1" step="0.1"
                                                    className={styles.smallInput}
                                                    value={item.quantity}
                                                    placeholder="0"
                                                    onChange={(e) => updateCartItem(item.product._id, 'quantity', e.target.value)}
                                                />
                                            </div>
                                            <div className={styles.inputGroup}>
                                                <label className={styles.inputLabel}>Price</label>
                                                <input
                                                    type="number" min="0" step="0.01"
                                                    className={styles.smallInput}
                                                    value={item.price}
                                                    onChange={(e) => updateCartItem(item.product._id, 'price', e.target.value)}
                                                />
                                            </div>
                                            <div style={{ marginLeft: 'auto', fontWeight: 'bold', fontSize: '0.95rem' }}>
                                                {formatPrice(((item.product.isCustom && (item.quantity === 0 || item.quantity === '')) ? 1 : item.quantity) * item.price)}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className={styles.cartFooter}>
                            <div className={styles.cartTotal}>
                                <span>Total</span>
                                <span>{formatPrice(calculateTotal())}</span>
                            </div>
                            <button
                                onClick={() => setStep(3)}
                                className={`${styles.btn} ${styles.btnSuccess}`}
                                style={{ width: '100%' }}
                                disabled={cart.length === 0}
                            >
                                Review Order →
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3: Review */}
            {step === 3 && (
                <div className={styles.reviewBox}>
                    <h4 style={{ textAlign: 'center', marginBottom: '30px', color: '#2c3e50' }}>Confirm Order Details</h4>

                    <div className={styles.customerSummary}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ color: '#6c757d' }}>Customer:</span>
                            <span style={{ fontWeight: '600' }}>{selectedUser?.name} ({selectedUser?.mobile})</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ color: '#6c757d' }}>Address:</span>
                            <span style={{ textAlign: 'right', maxWidth: '60%' }}>{selectedUser?.address || 'N/A'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#6c757d', fontWeight: '500' }}>Order Date:</span>
                            <input
                                type="date"
                                value={orderDate}
                                onChange={(e) => setOrderDate(e.target.value)}
                                className={styles.modalInput}
                                style={{ width: 'auto', padding: '6px 12px', marginBottom: 0 }}
                                max={new Date().toISOString().split('T')[0]} // Optionally restrict future dates, but user just said "any date"
                            />
                        </div>
                    </div>

                    <table className={styles.reviewTable}>
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th style={{ textAlign: 'center' }}>Qty</th>
                                <th style={{ textAlign: 'right' }}>Price</th>
                                <th style={{ textAlign: 'right' }}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cart.map((item, idx) => {
                                const isQtyEmpty = item.product.isCustom && (item.quantity === 0 || item.quantity === '');
                                return (
                                    <tr key={idx}>
                                        <td>{item.product.name}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            {isQtyEmpty ? 'N/A' : `${item.quantity} ${item.product.unit || ''}`}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            {formatPrice(item.price)}
                                            {!item.product.isCustom && item.price !== item.product.price && <span className={styles.modifiedPrice}>(Modified)</span>}
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: '600' }}>
                                            {formatPrice((isQtyEmpty ? 1 : item.quantity) * item.price)}
                                        </td>
                                    </tr>
                                );
                            })}
                            <tr style={{ background: '#f8f9fa' }}>
                                <td colSpan="3" style={{ textAlign: 'right', fontWeight: '700', fontSize: '1.1rem' }}>Grand Total:</td>
                                <td style={{ textAlign: 'right', fontWeight: '700', fontSize: '1.1rem', color: '#2c3e50' }}>{formatPrice(calculateTotal())}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end' }}>
                        <button onClick={() => setStep(2)} className={`${styles.btn} ${styles.btnOutline}`}>Back to Edit</button>
                        <button onClick={handleSubmitOrder} className={`${styles.btn} ${styles.btnSuccess}`} disabled={loading} style={{ minWidth: '200px' }}>
                            {loading ? 'Creating Order...' : 'Confirm & Create Order'}
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}
