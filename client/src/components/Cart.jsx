import { useState } from 'react';
import { useCart } from '../context/CartContext';
import './Cart.css';

export default function Cart({ message = '', onMessageChange }) {
    const { cart, editContext, updateCartItem, removeFromCart, placeOrder } = useCart();
    const [editingIndex, setEditingIndex] = useState(null);
    const [editQuantity, setEditQuantity] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleEditClick = (index) => {
        setEditingIndex(index);
        setEditQuantity(cart[index].quantity.toString());
    };

    const handleSaveEdit = async (index) => {
        const newQty = parseFloat(editQuantity);
        if (!newQty || newQty <= 0) {
            alert('Please enter a valid quantity greater than 0');
            return;
        }

        const item = cart[index];
        if (item.quantityLimit > 0 && newQty > item.quantityLimit) {
            alert(`Limit exceeded: You can only order up to ${item.quantityLimit} ${item.unit}.`);
            return;
        }

        try {
            await updateCartItem(item.productId, newQty);
            setEditingIndex(null);
            onMessageChange?.(`Quantity updated for ${item.productName}`);
            setTimeout(() => onMessageChange?.(''), 2000);
        } catch (err) {
            alert('Failed to update quantity. Please try again.');
        }
    };

    const handleCancelEdit = (index) => {
        setEditingIndex(null);
        setEditQuantity(cart[index].quantity.toString());
    };

    const handleRemove = async (productId) => {
        await removeFromCart(productId);
    };

    const handlePlaceOrder = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
            const result = await placeOrder();
            onMessageChange?.(result.message || 'Order placed successfully!');
            setTimeout(() => {
                window.location.href = '/myorders';
            }, 1500);
        } catch (err) {
            onMessageChange?.(err.message || 'Failed to place order.');
            setIsSubmitting(false);
        }
    };

    const handleCancelEditMode = () => {
        sessionStorage.removeItem('orderToEdit');
        window.location.href = '/myorders';
    };

    if (cart.length === 0 && !editContext) {
        return null;
    }

    return (
        <div className="amazon-cart" id="cart-section">
            <h3>Shopping Cart</h3>
            <div className="cart-items" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                {cart.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#555' }}>
                        Your cart is empty. Click "Update Order" to remove the order.
                    </p>
                ) : (
                    cart.map((item, index) => (
                        <div key={item.productId} className={`cart-item ${index % 2 === 0 ? 'even' : 'odd'}`}>
                            <div className="cart-item-info">
                                <strong>{item.productName}</strong>
                                {item.description && (
                                    <>
                                        <br />
                                        <small style={{ color: '#555' }}>{item.description}</small>
                                    </>
                                )}
                                <br />
                                {editingIndex === index ? (
                                    <div className="quantity-edit">
                                        <input
                                            type="tel"
                                            maxLength="5"
                                            pattern="[0-9.]*"
                                            value={editQuantity}
                                            onChange={(e) => setEditQuantity(e.target.value)}
                                            style={{ width: '80px', marginRight: '5px' }}
                                        />
                                        <span>{item.unit || ''}</span>
                                    </div>
                                ) : (
                                    <span className="quantity-display">
                                        Quantity: {item.quantity} {item.unit || ''}
                                    </span>
                                )}
                            </div>
                            <div className="cart-item-actions">
                                {editingIndex === index ? (
                                    <>
                                        <button className="save-btn" onClick={() => handleSaveEdit(index)}>Save</button>
                                        <button className="cancel-btn" onClick={() => handleCancelEdit(index)}>Cancel</button>
                                    </>
                                ) : (
                                    <button className="edit-btn" onClick={() => handleEditClick(index)}>Edit</button>
                                )}
                                <button className="remove-btn" onClick={() => handleRemove(item.productId)}>X</button>
                            </div>
                        </div>
                    ))
                )}
            </div>
            <div className="cart-footer">
                <button
                    id="placeOrderBtn"
                    onClick={handlePlaceOrder}
                    disabled={isSubmitting}
                    style={{
                        opacity: isSubmitting ? 0.6 : 1,
                        cursor: isSubmitting ? 'not-allowed' : 'pointer'
                    }}
                >
                    {isSubmitting ? 'Processing...' : (editContext ? 'Update Order' : 'Place Order For All Items')}
                </button>
                {editContext && (
                    <button id="cancelEditBtn" onClick={handleCancelEditMode}>
                        Cancel
                    </button>
                )}
            </div>
            {message && <p className="cart-message">{message}</p>}
        </div>
    );
}
