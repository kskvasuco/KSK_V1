import { useState } from 'react';
import './ProductCard.css';

export default function ProductCard({ product, isLoggedIn, onAddToCart }) {
    const [quantity, setQuantity] = useState('');

    const handleAddToCart = () => {
        const qty = parseFloat(quantity) || 0;
        if (qty <= 0) {
            alert('Please enter a valid quantity.');
            return;
        }
        onAddToCart(product, qty);
        setQuantity('');
    };

    const handleBlur = (e) => {
        // Check if blur is caused by clicking the "Add to Cart" button
        // If so, skip auto-add since the button click will handle it
        const relatedTarget = e.relatedTarget;
        if (relatedTarget && relatedTarget.classList.contains('add-btn')) {
            return; // Skip auto-add, let button handle it
        }

        // Auto-add to cart when user moves to another field
        const qty = parseFloat(quantity) || 0;
        if (qty > 0) {
            handleAddToCart();
        }
    };

    return (
        <div className="amazon-product-card">
            <div className="product-image">
                {product.imageData ? (
                    <img
                        src={product.imageData}
                        alt={product.name}
                        onError={(e) => {
                            e.target.parentElement.innerHTML = '<span class="placeholder-icon">🧱</span>';
                        }}
                    />
                ) : (
                    <span className="placeholder-icon">🧱</span>
                )}
            </div>
            <div className="product-name">{product.name}</div>
            <div className="product-desc">{product.description || ''}</div>
            <div className="product-unit">{product.unit || ''}</div>

            {isLoggedIn && (
                <div className="product-actions">
                    <input
                        type="tel"
                        maxLength="5"
                        pattern="[0-9.]*"
                        className="qty-input"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        onBlur={handleBlur}
                        placeholder=""
                    />
                    <button className="add-btn" onClick={handleAddToCart}>
                        Add to Cart
                    </button>
                </div>
            )}
        </div>
    );
}
