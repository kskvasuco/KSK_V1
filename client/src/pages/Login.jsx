import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Marquee from '../components/Marquee';
import AboutSection from '../components/AboutSection';
import ContactSection from '../components/ContactSection';
import Footer from '../components/Footer';
import SectionDivider from '../components/SectionDivider';
import './Login.css';
import './Home.css'; // Import Home styles for Navbar, Footer, etc.

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

        // Check if mobile number starts with 6, 7, 8, or 9
        if (!/^[6-9]/.test(mobile)) {
            setError('Enter a Valid Mobile Number');
            return;
        }

        // Check if all digits are the same (e.g., 5555555555)
        if (/^(\d)\1{9}$/.test(mobile)) {
            setError('Invalid mobile number.');
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
        <div className="home-page">
            <Navbar showSearch={false} />

            <Marquee />

            <div className="login-section login-control-section">
                <div className="auth-container">
                    {/* Logo Section */}
                    <div className="login-logo">
                        <h2>KSK VASU & Co</h2>
                        <span className="tamil-title">Construction Material Service Center</span>
                        <p className="welcome-text">வாடிக்கையாளர்களை அன்புடன் வரவேற்கின்றோம்</p>
                        <p className="blessing-text">வாழ்க வளமுடன்</p>
                    </div>

                    {/* Login Card */}
                    <div className="login-card">
                        <h1 className="login-card-title">Use your mobile number to continue</h1>
                        {/* <p className="login-card-subtitle"></p> */}

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
                </div>
            </div>

            <SectionDivider />

            <AboutSection />

            <SectionDivider />

            <ContactSection />

            <Footer />
        </div>
    );
}
