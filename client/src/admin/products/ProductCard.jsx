import React from 'react';
import styles from '../adminStyles.module.css';

export default function ProductCard({ product, onEdit, onDelete }) {
    const formatCurrency = (amount) => `₹${amount?.toFixed(2) || '0.00'}`;

    return (
        <div className={styles.productCard}>
            {product.image && (
                <div className={styles.productImage}>
                    <img src={product.image} alt={product.name} />
                </div>
            )}

            <div className={styles.productInfo}>
                <h4 className={styles.productName}>{product.name}</h4>

                {product.description && (
                    <p className={styles.productDescription}>{product.description}</p>
                )}

                <div className={styles.productDetails}>
                    <div className={styles.productPrice}>
                        <strong>Price:</strong> {formatCurrency(product.price)} / {product.unit || 'unit'}
                    </div>

                    {product.sku && (
                        <div className={styles.productSku}>
                            <strong>SKU:</strong> {product.sku}
                        </div>
                    )}

                    {product.quantityLimit && (
                        <div className={styles.productLimit}>
                            <strong>Stock Limit:</strong> {product.quantityLimit}
                        </div>
                    )}
                </div>

                <div className={styles.productActions}>
                    <button onClick={() => onEdit(product)} className={styles.btnEdit}>
                        📝 Edit
                    </button>
                    <button onClick={() => onDelete(product._id)} className={styles.btnDelete}>
                        🗑️ Delete
                    </button>
                </div>
            </div>
        </div>
    );
}
