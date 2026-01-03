import React from 'react';
import styles from '../adminStyles.module.css';

export default function ProductCard({ product, onEdit, onDelete, onToggleVisibility }) {
    const formatCurrency = (amount) => {
        const num = amount || 0;
        return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <div className={styles.productCard}>
            {product.image && (
                <div className={styles.productImage}>
                    <img src={product.image} alt={product.name} />
                </div>
            )}

            <div className={styles.productInfo}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <h4 className={styles.productName} style={{ margin: 0 }}>{product.name}</h4>
                    <span style={{
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        color: 'white',
                        backgroundColor: product.isVisible ? '#22c55e' : '#ef4444'
                    }}>
                        {product.isVisible ? 'VISIBLE' : 'HIDDEN'}
                    </span>
                </div>

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
                    <button
                        onClick={() => onToggleVisibility(product._id, !product.isVisible)}
                        style={{
                            flex: 1,
                            padding: '8px 12px',
                            background: product.isVisible ? '#ffc107' : '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            transition: 'background 0.2s'
                        }}
                    >
                        {product.isVisible ? '👁️ Hide' : '👁️ Show'}
                    </button>
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
