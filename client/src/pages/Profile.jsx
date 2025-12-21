import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import * as api from '../services/api';
import './Profile.css';

export default function Profile() {
    const { user, loading: authLoading, updateProfile } = useAuth();
    const navigate = useNavigate();

    const [locations, setLocations] = useState({});
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        altMobile: '',
        district: '',
        taluk: '',
        address: '',
        pincode: ''
    });

    useEffect(() => {
        loadLocations();
    }, []);

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || '',
                email: user.email || '',
                altMobile: user.altMobile || '',
                district: user.district || '',
                taluk: user.taluk || '',
                address: user.address || '',
                pincode: user.pincode || ''
            });
        }
    }, [user]);

    const loadLocations = async () => {
        try {
            const locs = await api.getLocations();
            setLocations(locs);
        } catch (err) {
            console.error('Failed to load locations', err);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Reset taluk when district changes
        if (name === 'district') {
            setFormData(prev => ({ ...prev, taluk: '' }));
        }
    };

    const handleSave = async () => {
        setMessage({ text: '', type: '' });

        // Validation
        if (formData.altMobile && !/^\d{10}$/.test(formData.altMobile)) {
            setMessage({ text: 'Alternative mobile number must be exactly 10 digits.', type: 'error' });
            return;
        }
        if (formData.name && formData.name.length > 29) {
            setMessage({ text: 'Name must be 29 characters or less.', type: 'error' });
            return;
        }
        if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
            setMessage({ text: 'Please enter a valid email address.', type: 'error' });
            return;
        }
        if (formData.address && formData.address.length > 150) {
            setMessage({ text: 'Address must be 150 characters or less.', type: 'error' });
            return;
        }
        if (formData.pincode && !/^\d{6}$/.test(formData.pincode)) {
            setMessage({ text: 'Pincode must be exactly 6 digits.', type: 'error' });
            return;
        }

        try {
            setSaving(true);
            await updateProfile(formData);
            setMessage({ text: 'Profile updated successfully!', type: 'success' });
            setIsEditing(false);
            setTimeout(() => setMessage({ text: '', type: '' }), 3000);
        } catch (err) {
            setMessage({ text: err.message || 'Failed to update profile.', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setMessage({ text: '', type: '' });
        // Reset form to original values
        if (user) {
            setFormData({
                name: user.name || '',
                email: user.email || '',
                altMobile: user.altMobile || '',
                district: user.district || '',
                taluk: user.taluk || '',
                address: user.address || '',
                pincode: user.pincode || ''
            });
        }
    };

    if (authLoading) {
        return <LoadingSpinner message="Loading profile..." />;
    }

    if (!user) {
        navigate('/login');
        return null;
    }

    const sortedDistricts = Object.keys(locations).sort();
    const taluks = formData.district ? (locations[formData.district] || []).sort() : [];

    return (
        <div className="profile-page">
            <Navbar />

            <div className="profile-container">
                <h1 className="profile-title">My Profile</h1>

                <div className="card">
                    {/* Display View */}
                    {!isEditing && (
                        <div className="display-view">
                            <div className="profile-field">
                                <label>Mobile Number</label>
                                <span>{user.mobile || 'N/A'}</span>
                            </div>
                            <div className="profile-field">
                                <label>Alternative Mobile</label>
                                <span>{user.altMobile || 'N/A'}</span>
                            </div>
                            <div className="profile-field">
                                <label>Name</label>
                                <span>{user.name || 'N/A'}</span>
                            </div>
                            <div className="profile-field">
                                <label>Email</label>
                                <span>{user.email || 'N/A'}</span>
                            </div>
                            <div className="profile-field">
                                <label>District</label>
                                <span>{user.district || 'N/A'}</span>
                            </div>
                            <div className="profile-field">
                                <label>Taluk</label>
                                <span>{user.taluk || 'N/A'}</span>
                            </div>
                            <div className="profile-field">
                                <label>Address</label>
                                <span>{user.address || 'N/A'}</span>
                            </div>
                            <div className="profile-field">
                                <label>Pincode</label>
                                <span>{user.pincode || 'N/A'}</span>
                            </div>

                            <button className="btn edit-btn" onClick={() => setIsEditing(true)}>
                                Edit Profile
                            </button>
                        </div>
                    )}

                    {/* Edit View */}
                    {isEditing && (
                        <div className="edit-view">
                            <div className="form-group">
                                <label>Mobile Number</label>
                                <input type="text" value={user.mobile || ''} disabled />
                            </div>

                            <div className="form-group">
                                <label>Alternative Mobile</label>
                                <input
                                    type="tel"
                                    name="altMobile"
                                    value={formData.altMobile}
                                    onChange={handleInputChange}
                                    maxLength="10"
                                    placeholder="Alternative 10-digit mobile"
                                />
                            </div>

                            <div className="form-group">
                                <label>Name</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    maxLength="29"
                                    placeholder="Your name"
                                />
                            </div>

                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    placeholder="your.email@example.com"
                                />
                            </div>

                            <div className="form-group">
                                <label>District</label>
                                <select name="district" value={formData.district} onChange={handleInputChange}>
                                    <option value="">Select district</option>
                                    {sortedDistricts.map(d => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Taluk</label>
                                <select name="taluk" value={formData.taluk} onChange={handleInputChange}>
                                    <option value="">Select taluk</option>
                                    {taluks.map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Address</label>
                                <textarea
                                    name="address"
                                    value={formData.address}
                                    onChange={handleInputChange}
                                    maxLength="150"
                                    placeholder="Your full address"
                                    rows="3"
                                />
                            </div>

                            <div className="form-group">
                                <label>Pincode</label>
                                <input
                                    type="text"
                                    name="pincode"
                                    value={formData.pincode}
                                    onChange={handleInputChange}
                                    maxLength="6"
                                    placeholder="6-digit pincode"
                                />
                            </div>

                            <div className="button-group">
                                <button
                                    className="btn save-btn"
                                    onClick={handleSave}
                                    disabled={saving}
                                >
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button className="btn cancel-btn" onClick={handleCancel}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {message.text && (
                        <p className={`message ${message.type}`}>{message.text}</p>
                    )}
                </div>
            </div>
        </div>
    );
}
