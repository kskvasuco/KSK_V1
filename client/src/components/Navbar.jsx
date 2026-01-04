import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar({ showSearch = false, searchValue = '', onSearchChange, hideBookNow = false }) {
    const { isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);

    const handleLogout = async (e) => {
        e.preventDefault();
        await logout();
        navigate('/login');
        setMenuOpen(false);
    };

    const toggleMenu = () => {
        setMenuOpen(!menuOpen);
    };

    const closeMenu = () => {
        setMenuOpen(false);
    };

    return (
        <nav className="amazon-nav">
            <div className="nav-top">
                <Link to="/" className="nav-logo" onClick={closeMenu}>
                    <img src="/images/head.png" alt="KSK VASU & Co" onError={(e) => e.target.style.display = 'none'} />
                    <div className="nav-logo-text">
                        KSK VASU & Co.
                        <span>online</span>
                    </div>
                </Link>

                {showSearch && (
                    <div className="nav-search-row">
                        <span className="nav-search-label">Our Products</span>
                        <div className="nav-search">
                            <input
                                type="text"
                                placeholder="Search products..."
                                value={searchValue}
                                onChange={(e) => onSearchChange?.(e.target.value)}
                            />
                            <button type="button">
                                <svg viewBox="0 0 24 24">
                                    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                )}

                {/* Desktop Navigation Links */}
                <div className="nav-links desktop-nav">
                    <a href="https://kskvasu.co.in/">Home</a>
                    <a href="/products">Products</a>
                    <a href="#about">About</a>
                    <a href="#contact">Contact</a>
                    <Link to="/login" className="call-now-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                            <line x1="12" y1="22.08" x2="12" y2="12" />
                        </svg>
                        Book Now
                    </Link>
                </div>

                {/* Hamburger Menu Button */}
                <button
                    className={`hamburger-btn ${menuOpen ? 'active' : ''}`}
                    onClick={toggleMenu}
                    aria-label="Toggle menu"
                >
                    <span></span>
                    <span></span>
                    <span></span>
                </button>
            </div>

            {/* Mobile Menu Overlay */}
            <div className={`mobile-menu-overlay ${menuOpen ? 'active' : ''}`} onClick={closeMenu}></div>

            {/* Mobile Slide-in Menu */}
            <div className={`mobile-menu ${menuOpen ? 'active' : ''}`}>
                <div className="mobile-menu-header">
                    <div className="mobile-menu-logo">
                        <img src="/images/head.png" alt="KSK VASU & Co" onError={(e) => e.target.style.display = 'none'} />
                        <div>
                            <strong>KSK VASU & Co.</strong>
                            <span>online</span>
                        </div>
                    </div>
                </div>

                <div className="mobile-menu-links">
                    <a href="https://kskvasu.co.in/" onClick={closeMenu}>
                        <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" /></svg>
                        Home
                    </a>
                    <a href="/products" onClick={closeMenu}>
                        <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l4.59-4.58L18 11l-6 6z" /></svg>
                        Products
                    </a>
                    <a href="#about" onClick={closeMenu}>
                        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" /></svg>
                        About
                    </a>
                    <a href="#contact" onClick={closeMenu}>
                        <svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" /></svg>
                        Contact
                    </a>
                </div>
            </div>

            {isAuthenticated && (
                <div className="nav-sub" id="user-links">
                    <Link to="/" onClick={closeMenu}>🏠 Home</Link>
                    <Link to="/myorders" onClick={closeMenu}>📦 My Orders</Link>
                    <Link to="/profile" onClick={closeMenu}>👤 My Profile</Link>
                    <a href="#" onClick={handleLogout} className="nav-link-logout">🚪 Logout</a>
                </div>
            )}
        </nav>
    );
}
