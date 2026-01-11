import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import Navbar from '../components/Navbar';
import ProductCard from '../components/ProductCard';
import Cart from '../components/Cart';
import LoadingSpinner from '../components/LoadingSpinner';
import * as api from '../services/api';
import Marquee from '../components/Marquee';
import AboutSection from '../components/AboutSection';
import ContactSection from '../components/ContactSection';
import Footer from '../components/Footer';
import SectionDivider from '../components/SectionDivider';
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

            // Scroll to cart section
            setTimeout(() => {
                const cartSection = document.getElementById('shopping-cart-section');
                if (cartSection) {
                    cartSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);
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
            <Marquee />

            {/* Main Content */}
            <div className="main-content">
                {/* Cart Section */}
                {showCart && (
                    <div id="shopping-cart-section">
                        <Cart message={cartMessage} onMessageChange={setCartMessage} />
                    </div>
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
            <SectionDivider />

            {/* About Section */}
            <AboutSection />

            {/* Golden Divider */}
            <SectionDivider />

            {/* Contact Section */}
            <ContactSection />

            {/* Footer Section */}
            <Footer />
        </div>
    );
}
