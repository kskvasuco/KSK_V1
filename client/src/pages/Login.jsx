import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

export default function Login() {
    const [mobile, setMobile] = useState('');
    const [confirmMobile, setConfirmMobile] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!mobile || !confirmMobile) {
            setError('Please enter your mobile number in both fields.');
            return;
        }

        if (!/^\d{10}$/.test(mobile)) {
            setError('Mobile number must be exactly 10 digits.');
            return;
        }

        if (mobile !== confirmMobile) {
            setError('Mobile numbers do not match. Please confirm correctly.');
            return;
        }

        try {
            setLoading(true);
            await login(mobile, confirmMobile);
            navigate('/');
        } catch (err) {
            setError(err.message || 'An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="auth-container">
                {/* Logo Section */}
                <div className="login-logo">
                    <img src="/images/head.png" alt="KSK VASU & Co" onError={(e) => e.target.style.display = 'none'} />
                    <h2>KSK VASU & Co</h2>
                    <span className="tamil-title">Construction Material Service Center</span>
                    <p className="welcome-text">வாடிக்கையாளர்களை அன்புடன் வரவேற்கின்றோம்</p>
                    <p className="blessing-text">வாழ்க வளமுடன்</p>
                </div>

                {/* Login Card */}
                <div className="login-card">
                    <h1 className="login-card-title">Sign In</h1>
                    <p className="login-card-subtitle">Use your mobile number to continue</p>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <input
                                type="tel"
                                id="mobile"
                                value={mobile}
                                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                                placeholder=" "
                                maxLength="10"
                                autoComplete="tel"
                            />
                            <label htmlFor="mobile">Mobile Number</label>
                        </div>

                        <div className="form-group">
                            <input
                                type="tel"
                                id="confirmMobile"
                                value={confirmMobile}
                                onChange={(e) => setConfirmMobile(e.target.value.replace(/\D/g, ''))}
                                placeholder=" "
                                maxLength="10"
                                autoComplete="tel"
                            />
                            <label htmlFor="confirmMobile">Confirm Mobile Number</label>
                        </div>

                        {error && <p className="error-message">{error}</p>}

                        <button
                            type="submit"
                            className="login-btn"
                            disabled={loading}
                        >
                            {loading ? 'Signing in...' : 'Continue'}
                        </button>
                    </form>

                    <p className="login-info">
                        KSK VASU & Co - Building Materials Service Center
                    </p>
                </div>

                <p className="back-link">
                    <Link to="/">← Back to Products</Link>
                </p>
            </div>
        </div>
    );
}
