import React, { useState, useEffect } from 'react';
import adminApi from '../adminApi';
import styles from '../adminStyles.module.css';

export default function ProductForm({ product, onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        unit: '',
        sku: '',
        quantityLimit: '',
        image: ''
    });
    const [imagePreview, setImagePreview] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (product) {
            setFormData({
                name: product.name || '',
                description: product.description || '',
                price: product.price || '',
                unit: product.unit || '',
                sku: product.sku || '',
                quantityLimit: product.quantityLimit || '',
                image: product.image || ''
            });
            setImagePreview(product.image || '');
        }
    }, [product]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Check file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            alert('Image size must be less than 2MB');
            e.target.value = '';
            return;
        }

        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result;
            setFormData(prev => ({ ...prev, image: base64String }));
            setImagePreview(base64String);
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveImage = () => {
        setFormData(prev => ({ ...prev, image: '' }));
        setImagePreview('');
        const fileInput = document.getElementById('productImageInput');
        if (fileInput) fileInput.value = '';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validation
        if (!formData.name.trim()) {
            setError('Product name is required');
            return;
        }
        if (!formData.price || parseFloat(formData.price) <= 0) {
            setError('Valid price is required');
            return;
        }

        try {
            setLoading(true);

            const productData = {
                name: formData.name.trim(),
                description: formData.description.trim(),
                price: parseFloat(formData.price),
                unit: formData.unit.trim() || 'unit',
                sku: formData.sku.trim(),
                quantityLimit: formData.quantityLimit ? parseFloat(formData.quantityLimit) : null,
                image: formData.image
            };

            if (product) {
                // Update existing product
                await adminApi.updateProduct(product._id, productData);
            } else {
                // Create new product
                await adminApi.createProduct(productData);
            }

            onSuccess();
        } catch (err) {
            console.error('Error saving product:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.modal}>
            <div className={styles.modalContent} style={{ maxWidth: '600px' }}>
                <h3>{product ? 'Edit Product' : 'Add New Product'}</h3>

                <form onSubmit={handleSubmit}>
                    <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                            <label htmlFor="name">Product Name *</label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                placeholder="e.g., Cement"
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="sku">SKU</label>
                            <input
                                type="text"
                                id="sku"
                                name="sku"
                                value={formData.sku}
                                onChange={handleChange}
                                placeholder="e.g., CEM-001"
                            />
                        </div>

                        <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                            <label htmlFor="description">Description</label>
                            <textarea
                                id="description"
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                rows="3"
                                placeholder="Product description..."
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="price">Price *</label>
                            <input
                                type="number"
                                id="price"
                                name="price"
                                value={formData.price}
                                onChange={handleChange}
                                required
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="unit">Unit</label>
                            <input
                                type="text"
                                id="unit"
                                name="unit"
                                value={formData.unit}
                                onChange={handleChange}
                                placeholder="e.g., Bag, Ton, Piece"
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="quantityLimit">Stock Limit</label>
                            <input
                                type="number"
                                id="quantityLimit"
                                name="quantityLimit"
                                value={formData.quantityLimit}
                                onChange={handleChange}
                                min="0"
                                placeholder="Optional"
                            />
                        </div>

                        <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                            <label htmlFor="productImageInput">Product Image</label>
                            <input
                                type="file"
                                id="productImageInput"
                                accept="image/*"
                                onChange={handleImageChange}
                            />
                            {imagePreview && (
                                <div className={styles.imagePreviewContainer}>
                                    <img src={imagePreview} alt="Preview" className={styles.imagePreview} />
                                    <button
                                        type="button"
                                        onClick={handleRemoveImage}
                                        className={styles.removeImageBtn}
                                    >
                                        ✕ Remove
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className={styles.formError}>{error}</div>
                    )}

                    <div className={styles.modalActions}>
                        <button type="submit" disabled={loading} className={styles.btnConfirm}>
                            {loading ? 'Saving...' : (product ? 'Update Product' : 'Add Product')}
                        </button>
                        <button type="button" onClick={onClose} className={styles.btnCancel}>
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
