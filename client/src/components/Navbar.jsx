import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar({ showSearch = false, searchValue = '', onSearchChange, hideBookNow = false }) {
    const { isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async (e) => {
        e.preventDefault();
        await logout();
        navigate('/login');
    };

    return (
        <nav className="amazon-nav">
            <div className="nav-top">
                <Link to="/" className="nav-logo">
                    <img src="/images/head.png" alt="KSK VASU & Co" onError={(e) => e.target.style.display = 'none'} />
                    <div className="nav-logo-text">
                        KSK VASU & Co
                        <span>கட்டுமான பொருட்கள்</span>
                    </div>
                </Link>

                {showSearch && (
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
                )}

                <div className="nav-links">
                    <div className="legacy-badge">
                        <span className="years">25</span> Years of Legacy
                    </div>
                    {/* Book Now button hidden on login page and when user is authenticated */}
                </div>
            </div>

            {isAuthenticated && (
                <div className="nav-sub" id="user-links">
                    <Link to="/">🏠 Home</Link>
                    <Link to="/myorders">📦 My Orders</Link>
                    <Link to="/profile">👤 My Profile</Link>
                    <a href="#" onClick={handleLogout} className="nav-link-logout">🚪 Logout</a>
                </div>
            )}
        </nav>
    );
}
