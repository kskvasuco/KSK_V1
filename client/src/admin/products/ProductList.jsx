import React, { useState, useEffect } from 'react';
import adminApi from '../adminApi';
import ProductCard from './ProductCard';
import ProductForm from './ProductForm';
import styles from '../adminStyles.module.css';

export default function ProductList() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);

    const fetchProducts = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await adminApi.getProducts();
            setProducts(data.products || []);
        } catch (err) {
            console.error('Error fetching products:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    const filteredProducts = products.filter(product =>
        searchQuery.trim() ? (
            product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            product.sku?.toLowerCase().includes(searchQuery.toLowerCase())
        ) : true
    );

    const handleAdd = () => {
        setEditingProduct(null);
        setShowForm(true);
    };

    const handleEdit = (product) => {
        setEditingProduct(product);
        setShowForm(true);
    };

    const handleDelete = async (productId) => {
        if (!window.confirm('Are you sure you want to delete this product?')) return;

        try {
            await adminApi.deleteProduct(productId);
            await fetchProducts();
        } catch (err) {
            console.error('Error deleting product:', err);
            alert(`Error: ${err.message}`);
        }
    };

    const handleFormClose = () => {
        setShowForm(false);
        setEditingProduct(null);
    };

    const handleFormSuccess = async () => {
        setShowForm(false);
        setEditingProduct(null);
        await fetchProducts();
    };

    // Drag and drop handlers
    const handleDragStart = (e, index) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', index);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        return false;
    };

    const handleDrop = async (e, dropIndex) => {
        e.preventDefault();
        const dragIndex = parseInt(e.dataTransfer.getData('text/html'));

        if (dragIndex === dropIndex) return;

        // Reorder products
        const reorderedProducts = [...filteredProducts];
        const [draggedItem] = reorderedProducts.splice(dragIndex, 1);
        reorderedProducts.splice(dropIndex, 0, draggedItem);

        // Update local state immediately
        setProducts(reorderedProducts);

        // Save new order to backend
        try {
            const orders = reorderedProducts.map((product, index) => ({
                id: product._id,
                displayOrder: index
            }));
            await adminApi.reorderProducts(orders);
        } catch (err) {
            console.error('Error saving product order:', err);
            // Revert on error
            await fetchProducts();
            alert(`Error: ${err.message}`);
        }
    };

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
                    <p>Error loading products: {error}</p>
                    <button onClick={fetchProducts}>Retry</button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.adminSection}>
            <div className={styles.sectionHeader}>
                <h3>Products ({products.length})</h3>
                <button onClick={handleAdd} className={styles.btnAdd}>+ Add Product</button>
            </div>

            <div className={styles.searchContainer}>
                <input
                    type="search"
                    placeholder="Search products by name or SKU..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={styles.searchInput}
                />
            </div>

            {filteredProducts.length === 0 ? (
                <div className={styles.emptyState}>
                    <p>No products found{searchQuery ? ' matching your search' : ''}.</p>
                </div>
            ) : (
                <div className={styles.productGrid}>
                    {filteredProducts.map((product, index) => (
                        <div
                            key={product._id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, index)}
                            style={{ cursor: 'move' }}
                        >
                            <ProductCard
                                product={product}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                            />
                        </div>
                    ))}
                </div>
            )}

            {showForm && (
                <ProductForm
                    product={editingProduct}
                    onClose={handleFormClose}
                    onSuccess={handleFormSuccess}
                />
            )}
        </div>
    );
}
