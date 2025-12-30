import React, { useState, useEffect } from 'react';
import staffApi from '../staffApi';
import styles from '../../admin/adminStyles.module.css';

export default function StaffProductList() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const data = await staffApi.getProducts();
                setProducts(data.products || []);
            } catch (err) {
                console.error('Error fetching products:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchProducts();
    }, []);

    const filteredProducts = products.filter(product => {
        if (!product.isVisible) return false;
        const term = searchTerm.toLowerCase();
        return (
            product.name.toLowerCase().includes(term) ||
            (product.sku && product.sku.toLowerCase().includes(term))
        );
    });

    if (loading) {
        return (
            <div className={styles.adminSection}>
                <h3>Products</h3>
                <div className={styles.loadingContainer}>
                    <div className={styles.loadingSpinner}></div>
                    <p>Loading products...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.adminSection}>
                <h3>Products</h3>
                <div className={styles.errorMessage}>
                    <p>Error: {error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.adminSection}>
            <h3>Products ({filteredProducts.length})</h3>

            <div className={styles.searchContainer}>
                <input
                    type="search"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={styles.searchInput}
                />
            </div>

            <div className={styles.productList}>
                {filteredProducts.map((product, index) => (
                    <div key={product._id} className={styles.productCard}>
                        {/* Use standard product card styling but simplified content */}
                        {product.image && (
                            <img
                                src={product.image}
                                alt={product.name}
                                className={styles.productImage}
                                style={{ height: '150px', objectFit: 'cover' }}
                            />
                        )}
                        <div className={styles.productInfo}>
                            <h4>{String(index + 1).padStart(3, '0')} - {product.name}</h4>
                            <p className={styles.productSku}>{product.sku || 'No SKU'}</p>
                            <p className={styles.productDetails}>{product.description || 'No description'}</p>
                            <div className={styles.productPrice}>
                                ₹{product.price.toFixed(2)} / {product.unit || 'unit'}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
