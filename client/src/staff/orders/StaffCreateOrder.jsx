import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import staffApi from '../staffApi';
import styles from './staffOrderStyles.module.css'; // Import professional CSS module

export default function StaffCreateOrder() {
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

    // Initial Load
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                const productsRes = await staffApi.getProducts();
                setProducts(productsRes.products || []);

                if (existingUserId) {
                    const allUsers = await staffApi.getAllUsers();
                    const user = allUsers.find(u => u._id === existingUserId);
                    if (user) {
                        setSelectedUser(user);
                        setStep(2);
                    }
                } else {
                    const visitedUsers = await staffApi.getUsers();
                    setUsers(visitedUsers);
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
            if (existing) return prev;
            return [...prev, { product, quantity: 1, price: product.price }];
        });
    };

    const removeFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.product._id !== productId));
    };

    const updateCartItem = (productId, field, value) => {
        setCart(prev => prev.map(item => {
            if (item.product._id === productId) {
                return { ...item, [field]: parseFloat(value) || 0 };
            }
            return item;
        }));
    };

    const calculateTotal = () => {
        return cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    };

    const handleSubmitOrder = async () => {
        if (!selectedUser || cart.length === 0) return;

        if (!window.confirm(`Create order for ${selectedUser.name || selectedUser.mobile} with ${cart.length} items? Total: ₹${calculateTotal().toFixed(2)}`)) return;

        setLoading(true);
        try {
            const isPriceChanged = cart.some(item => item.price !== item.product.price);

            const itemsPayload = cart.map(item => ({
                productId: item.product._id,
                quantity: item.quantity,
                price: item.price
            }));

            const endpoint = isPriceChanged
                ? '/api/admin/orders/create-for-user-rate-request'
                : '/api/admin/orders/create-for-user';

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ userId: selectedUser._id, items: itemsPayload })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || res.statusText);
            }

            alert('Order created successfully!');
            navigate('/staff/pending');

        } catch (err) {
            console.error("Order creation error:", err);
            alert(`Failed to create order: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (loading && !products.length) return <div className={styles.loadingContainer}>Loading...</div>;

    return (
        <div className={styles.container}>
            <h3 className={styles.pageTitle}>Create New Order</h3>

            {/* Professional Stepper */}
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
                    <div className={styles.searchContainer}>
                        <input
                            type="search"
                            placeholder="Search user by mobile or name..."
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                            className={styles.searchInput}
                            autoFocus
                        />
                    </div>
                    <div className={`${styles.grid} ${styles.userGrid}`}>
                        {filteredUsers.length === 0 && <p style={{ textAlign: 'center', color: '#888' }}>No users found matching "{userSearch}"</p>}
                        {filteredUsers.map(user => (
                            <div
                                key={user._id}
                                className={`${styles.card} ${selectedUser?._id === user._id ? styles.selected : ''}`}
                                onClick={() => { setSelectedUser(user); setStep(2); }}
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

            {/* Step 2: Product Selection (Split Layout) */}
            {step === 2 && (
                <div className={styles.splitView}>
                    {/* Left: Product List */}
                    <div className={styles.productSection}>
                        <div style={{ marginBottom: '20px' }}>
                            <input
                                type="search"
                                placeholder="Search products..."
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                className={styles.searchInput}
                            />
                        </div>
                        <div className={`${styles.grid} ${styles.productGrid}`}>
                            {filteredProducts.map(product => {
                                const inCart = cart.find(c => c.product._id === product._id);
                                return (
                                    <div key={product._id} className={styles.card}>
                                        {inCart && <div className={styles.addedBadge}>In Cart</div>}
                                        <div className={styles.cardBody} style={inCart ? { opacity: 0.7 } : {}}>
                                            <h4 className={styles.cardTitle} style={{ marginBottom: '5px' }}>{product.name}</h4>
                                            <div className={styles.cardText} style={{ fontSize: '0.85rem', marginBottom: '10px' }}>SKU: {product.sku || 'N/A'}</div>
                                            <div className={styles.productPrice}>₹{product.price}</div>
                                            <button
                                                onClick={() => addToCart(product)}
                                                disabled={inCart}
                                                className={`${styles.btn} ${inCart ? styles.btnSecondary : styles.btnPrimary}`}
                                                style={{ marginTop: '15px', width: '100%' }}
                                            >
                                                {inCart ? 'Adjust' : 'Add to Cart'}
                                            </button>
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
                                <div style={{ fontSize: '0.9rem', color: '#6c757d' }}>{selectedUser?.name}</div>
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
                                            <button onClick={() => removeFromCart(item.product._id)} className={styles.btnRemove} title="Remove">✕</button>
                                        </div>
                                        <div className={styles.cartControls}>
                                            <div className={styles.inputGroup}>
                                                <label className={styles.inputLabel}>Qty</label>
                                                <input
                                                    type="number" min="0.1" step="0.1"
                                                    className={styles.smallInput}
                                                    value={item.quantity}
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
                                                ₹{(item.quantity * item.price).toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className={styles.cartFooter}>
                            <div className={styles.cartTotal}>
                                <span>Total</span>
                                <span>₹{calculateTotal().toFixed(2)}</span>
                            </div>
                            <button
                                onClick={() => setStep(3)}
                                className={`${styles.btn} ${styles.btnSuccess}`}
                                style={{ width: '100%' }}
                                disabled={cart.length === 0}
                            >
                                Review Order →
                            </button>
                            <button
                                onClick={() => { setStep(1); setCart([]); }}
                                className={`${styles.btn} ${styles.btnOutline}`}
                                style={{ width: '100%', marginTop: '10px', fontSize: '0.85rem' }}
                            >
                                Start Over
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
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#6c757d' }}>Address:</span>
                            <span style={{ textAlign: 'right', maxWidth: '60%' }}>{selectedUser?.address || 'N/A'}</span>
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
                            {cart.map((item, idx) => (
                                <tr key={idx}>
                                    <td>{item.product.name}</td>
                                    <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        ₹{item.price.toFixed(2)}
                                        {item.price !== item.product.price && <span className={styles.modifiedPrice}>(Modified)</span>}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: '600' }}>₹{(item.quantity * item.price).toFixed(2)}</td>
                                </tr>
                            ))}
                            <tr style={{ background: '#f8f9fa' }}>
                                <td colSpan="3" style={{ textAlign: 'right', fontWeight: '700', fontSize: '1.1rem' }}>Grand Total:</td>
                                <td style={{ textAlign: 'right', fontWeight: '700', fontSize: '1.1rem', color: '#2c3e50' }}>₹{calculateTotal().toFixed(2)}</td>
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
