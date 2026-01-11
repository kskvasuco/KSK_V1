import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import Navbar from '../components/Navbar';
import ProductCard from '../components/ProductCard';
import Cart from '../components/Cart';
import LoadingSpinner from '../components/LoadingSpinner';
import * as api from '../services/api';
import './Home.css';

export default function Home() {
    const { isAuthenticated, loading: authLoading } = useAuth();
    const { cart, addToCart, editContext } = useCart();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [message, setMessage] = useState('');
    const [cartMessage, setCartMessage] = useState('');

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        try {
            setLoading(true);
            const data = await api.getPublicProducts();
            setProducts(data);
        } catch (err) {
            console.error('Failed to load products', err);
            setMessage('Failed to load products. Please refresh.');
        } finally {
            setLoading(false);
        }
    };

    // Filter products based on search term
    const filteredProducts = useMemo(() => {
        if (!searchTerm.trim()) return products;

        const term = searchTerm.toLowerCase();
        return products.filter(p =>
            p.name?.toLowerCase().includes(term) ||
            p.description?.toLowerCase().includes(term) ||
            p.unit?.toLowerCase().includes(term)
        );
    }, [products, searchTerm]);

    const handleAddToCart = async (product, quantity) => {
        // Check quantity limit
        const quantityLimit = product.quantityLimit || 0;
        if (quantityLimit > 0) {
            try {
                // Fetch quantities from active orders (Ordered/Paused status)
                const activeOrderQuantities = await api.getActiveOrderQuantities();
                const quantityInActiveOrders = activeOrderQuantities[product._id] || 0;

                // Check quantity in current cart
                const existingItem = cart.find(item => item.productId === product._id);
                const quantityInCart = existingItem ? existingItem.quantity : 0;

                // Calculate total quantity (active orders + cart + new quantity)
                const totalQuantity = quantityInActiveOrders + quantityInCart + quantity;

                if (totalQuantity > quantityLimit) {
                    let message = `Limit exceeded: You can only order up to ${quantityLimit} ${product.unit}.`;

                    if (quantityInActiveOrders > 0) {
                        message += `\nYou have ${quantityInActiveOrders} ${product.unit} in active orders.`;
                    }
                    if (quantityInCart > 0) {
                        message += `\nYou have ${quantityInCart} ${product.unit} in cart.`;
                    }
                    message += `\nTotal would be: ${totalQuantity} ${product.unit}`;

                    alert(message);
                    return;
                }
            } catch (err) {
                console.error('Failed to check active order quantities:', err);
                // Continue with basic cart-only check if API fails
                const existingItem = cart.find(item => item.productId === product._id);
                const currentQty = existingItem ? existingItem.quantity : 0;
                if (currentQty + quantity > quantityLimit) {
                    alert(`Limit exceeded: You can only order up to ${quantityLimit} ${product.unit}.\nYou have ${currentQty} ${product.unit} in cart.`);
                    return;
                }
            }
        }

        try {
            await addToCart(product, quantity);
            setMessage(`${product.name} added to ${editContext ? 'order' : 'cart'}.`);
            setTimeout(() => setMessage(''), 2000);
        } catch (err) {
            alert('Failed to add to cart. Please try again.');
        }
    };

    if (authLoading || loading) {
        return <LoadingSpinner message="" />;
    }

    const showCart = isAuthenticated && (cart.length > 0 || editContext);

    return (
        <div className="home-page">
            <Navbar
                showSearch={true}
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
            />

            {/* Promo Banner */}
            <div className="promo-banner">
                <div className="marquee-wrapper">
                    <div className="marquee-content">
                        <span>⭐ . . . தரமான கட்டுமான பொருட்களுக்கு, கைராசியான நிறுவனம் . . . ⭐ . . . Our Company Specializes in QUALITY CONSTRUCTION MATERIALS . . . ⭐ . . . Construction Planning and Hardware Solutions . . . ⭐</span>
                        <span>⭐ . . . தரமான கட்டுமான பொருட்களுக்கு, கைராசியான நிறுவனம் . . . ⭐ . . . Our Company Specializes in QUALITY CONSTRUCTION MATERIALS . . . ⭐ . . . Construction Planning and Hardware Solutions . . . ⭐</span>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="main-content">
                {/* Cart Section */}
                {showCart && (
                    <Cart message={cartMessage} onMessageChange={setCartMessage} />
                )}

                {/* Page Title */}
                <h2 className="page-title">
                    {editContext ? '✏️ Edit Your Order' : 'Our Products'}
                </h2>

                {/* Search Results Counter */}
                {searchTerm && (
                    <div className="search-counter">
                        {filteredProducts.length === 0 ? (
                            <span style={{ color: '#c7511f' }}>
                                No products found for "<strong>{searchTerm}</strong>"
                            </span>
                        ) : (
                            <span>
                                Showing <strong>{filteredProducts.length}</strong> of <strong>{products.length}</strong> products for "<strong>{searchTerm}</strong>"
                            </span>
                        )}
                    </div>
                )}

                {/* Products Grid */}
                <div className="amazon-products">
                    {filteredProducts.map(product => (
                        <ProductCard
                            key={product._id}
                            product={product}
                            isLoggedIn={isAuthenticated}
                            onAddToCart={handleAddToCart}
                        />
                    ))}
                </div>

                {message && <p className="message">{message}</p>}
            </div>

            {/* Sticky Book Now Button for non-logged-in users */}
            {!isAuthenticated && (
                <div className="sticky-book-now">
                    <Link to="/login" className="sticky-book-now-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                            <line x1="12" y1="22.08" x2="12" y2="12" />
                        </svg>
                        Book Now
                    </Link>
                </div>
            )}

            {/* Golden Divider */}
            <div className="section-divider"></div>

            {/* About Section */}
            <section id="about" className="about-section">
                <div className="about-container">
                    <div className="about-header">
                        <h2>About KSK VASU & Co.</h2>
                        <div className="about-divider"></div>
                    </div>
                    <div className="about-content">
                        <div className="about-image">
                            <img src="/images/head.png" alt="KSK VASU & Co." onError={(e) => e.target.style.display = 'none'} />
                        </div>
                        <div className="about-text">
                            <h3>Your Trusted Partner for Quality Construction Materials</h3>
                            <p>
                                KSK VASU & Co. has been serving the construction industry for decades, providing
                                premium quality building materials including bricks, Solid blocks, cement, M-sand, P-Sand and Hardware Materials.
                                Our commitment to quality and customer satisfaction has made us a trusted name in the industry.
                            </p>
                            <ul className="about-features">
                                <li>✓ Building Planning</li>
                                <li>✓ Hardware Solutions</li>
                                <li>✓ Premium Quality Products</li>
                                <li>✓ Competitive Pricing</li>
                                <li>✓ Fast & Reliable Delivery</li>
                                <li>✓ Expert Customer Support</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Golden Divider */}
            <div className="section-divider"></div>

            {/* Contact Section */}
            <section id="contact" className="contact-section">
                <div className="contact-container">
                    <div className="contact-header">
                        <h2>Contact Us</h2>
                        <div className="contact-divider"></div>
                        <p>Get in touch with us for orders and inquiries</p>
                    </div>
                    <div className="contact-cards">
                        <a href="tel:9443350464" className="contact-card phone-card">
                            <div className="contact-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                </svg>
                            </div>
                            <div className="contact-info">
                                <h4>Call Us Now</h4>
                                <span className="contact-value">9443350464</span>
                                <small>Tap to call</small>
                            </div>
                        </a>
                        <a href="https://wa.me/919443350464" target="_blank" rel="noopener noreferrer" className="contact-card whatsapp-card">
                            <div className="contact-icon">
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                            </div>
                            <div className="contact-info">
                                <h4>WhatsApp</h4>
                                <span className="contact-value">Message Us</span>
                                <small>Quick response</small>
                            </div>
                        </a>
                        <a href="https://maps.app.goo.gl/bKYi6iFRUcLBSPBZ9" target="_blank" rel="noopener noreferrer" className="contact-card location-card">
                            <div className="contact-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                            </div>
                            <div className="contact-info">
                                <h4>Visit Us</h4>
                                <span className="contact-value">Tamil Nadu</span>
                                <span className="contact-value">Erode</span>
                            </div>
                        </a>
                    </div>
                </div>
            </section>

            {/* Footer Section */}
            <footer className="site-footer">
                <h3>KSK VASU & Co.</h3>
                <p className="footer-tagline">Our Construction Materials To Build Your Dream Project</p>
            </footer>
        </div>
    );
}
