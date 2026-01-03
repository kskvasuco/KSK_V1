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
    const [manageMode, setManageMode] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);

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
        setDraggedIndex(index);
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverIndex(index);
        return false;
    };

    const handleDragLeave = () => {
        setDragOverIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleDrop = async (e, dropIndex) => {
        e.preventDefault();
        const dragIndex = parseInt(e.dataTransfer.getData('text/html'));

        setDraggedIndex(null);
        setDragOverIndex(null);

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

    const handleToggleVisibility = async (productId, newVisibility) => {
        try {
            await adminApi.toggleProductVisibility(productId, newVisibility);
            // Update local state immediately for better UX
            setProducts(prevProducts =>
                prevProducts.map(p =>
                    p._id === productId ? { ...p, isVisible: newVisibility } : p
                )
            );
        } catch (err) {
            console.error('Error toggling product visibility:', err);
            alert(`Error: ${err.message}`);
            // Refresh to get correct state from server
            await fetchProducts();
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
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => setManageMode(!manageMode)}
                        style={{
                            padding: '10px 20px',
                            background: manageMode ? '#6c757d' : '#17a2b8',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            transition: 'background 0.2s'
                        }}
                    >
                        {manageMode ? '← Back' : '⚙️ Manage Products'}
                    </button>
                    {manageMode && (
                        <button onClick={handleAdd} className={styles.btnAdd}>
                            + Add Product
                        </button>
                    )}
                </div>
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
            ) : manageMode ? (
                // Manage Mode: Full grid with drag-and-drop and editing
                <div className={styles.productGrid}>
                    {filteredProducts.map((product, index) => (
                        <div
                            key={product._id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragLeave={handleDragLeave}
                            onDragEnd={handleDragEnd}
                            onDrop={(e) => handleDrop(e, index)}
                            style={{
                                cursor: 'move',
                                opacity: draggedIndex === index ? 0.5 : 1,
                                transform: dragOverIndex === index && draggedIndex !== index ? 'scale(1.02)' : 'scale(1)',
                                transition: 'all 0.2s ease',
                                border: dragOverIndex === index && draggedIndex !== index ? '2px dashed #1a73e8' : '2px dashed transparent',
                                borderRadius: '12px',
                                padding: dragOverIndex === index && draggedIndex !== index ? '2px' : '0'
                            }}
                        >
                            <ProductCard
                                product={product}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onToggleVisibility={handleToggleVisibility}
                            />
                        </div>
                    ))}
                </div>
            ) : (
                // View Mode: Simple list
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '20px',
                    marginTop: '20px'
                }}>
                    {filteredProducts.map((product, index) => (
                        <div
                            key={product._id}
                            style={{
                                background: 'white',
                                borderRadius: '12px',
                                padding: '20px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '15px',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                                cursor: 'default'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                            }}
                        >
                            {product.image && (
                                <img
                                    src={product.image}
                                    alt={product.name}
                                    style={{
                                        width: '80px',
                                        height: '80px',
                                        borderRadius: '8px',
                                        objectFit: 'cover',
                                        flexShrink: 0
                                    }}
                                />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                                    <span style={{
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        color: '#6c757d',
                                        flexShrink: 0
                                    }}>
                                        #{String(index + 1).padStart(2, '0')}
                                    </span>
                                    <span style={{
                                        padding: '4px 8px',
                                        borderRadius: '10px',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        color: 'white',
                                        backgroundColor: product.isVisible ? '#22c55e' : '#ef4444',
                                        flexShrink: 0
                                    }}>
                                        {product.isVisible ? 'VISIBLE' : 'HIDDEN'}
                                    </span>
                                </div>
                                <h4 style={{
                                    margin: '0 0 6px 0',
                                    fontSize: '16px',
                                    fontWeight: '600',
                                    color: '#202124',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {product.name}
                                </h4>
                                <p style={{
                                    margin: '0 0 6px 0',
                                    fontSize: '13px',
                                    color: '#5f6368'
                                }}>
                                    {product.sku || 'No SKU'}
                                </p>
                                <p style={{
                                    margin: 0,
                                    fontSize: '15px',
                                    fontWeight: '600',
                                    color: '#28a745'
                                }}>
                                    ₹{product.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {product.unit || 'unit'}
                                </p>
                            </div>
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
