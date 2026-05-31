import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import adminApi from './adminApi';

function LedgerDashboard() {
    const navigate = useNavigate();
    const [summary, setSummary] = useState({ netBalance: 0, totalYouGave: 0, totalYouGot: 0 });
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Active Tab state
    const [activeTab, setActiveTab] = useState('Customer'); // 'Customer' or 'Supplier'

    // Create Modal state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [formName, setFormName] = useState('');
    const [formMobile, setFormMobile] = useState('');
    const [formAltMobile, setFormAltMobile] = useState('');
    const [formEmail, setFormEmail] = useState('');
    const [formDistrict, setFormDistrict] = useState('');
    const [formTaluk, setFormTaluk] = useState('');
    const [formAddress, setFormAddress] = useState('');
    const [formPincode, setFormPincode] = useState('');
    const [formOpeningBalance, setFormOpeningBalance] = useState('');
    const [formOpeningBalanceType, setFormOpeningBalanceType] = useState('debit');
    const [formSubmitting, setFormSubmitting] = useState(false);
    const formSubmittingRef = useRef(false);

    // Existing Registered User Link States
    const [allExistingUsers, setAllExistingUsers] = useState([]);
    const [isExistingUserLink, setIsExistingUserLink] = useState(false);
    const [selectedExistingUserId, setSelectedExistingUserId] = useState('');

    useEffect(() => {
        if (showCreateModal) {
            fetchExistingUsers();
        }
    }, [showCreateModal]);

    const fetchExistingUsers = async () => {
        try {
            const data = await adminApi.getAllUsers();
            const filtered = (data || []).filter(u => !u.isAddedToLedger && !u.isDeleted);
            setAllExistingUsers(filtered);
        } catch (err) {
            console.error("Failed to load existing users:", err);
        }
    };

    const handleSelectExistingUser = (userId) => {
        setSelectedExistingUserId(userId);
        const u = allExistingUsers.find(x => x._id === userId);
        if (u) {
            setFormName(u.name || '');
            setFormMobile(u.mobile || '');
            setFormAltMobile(u.altMobile || '');
            setFormEmail(u.email || '');
            setFormDistrict(u.district || '');
            setFormTaluk(u.taluk || '');
            setFormAddress(u.address || '');
            setFormPincode(u.pincode || '');
        } else {
            setFormName('');
            setFormMobile('');
            setFormAltMobile('');
            setFormEmail('');
            setFormDistrict('');
            setFormTaluk('');
            setFormAddress('');
            setFormPincode('');
        }
    };

    // Filters state
    const [search, setSearch] = useState('');
    const [locations, setLocations] = useState({});

    // Bulk sync state
    const [syncing, setSyncing] = useState(false);
    const [hoveredUserId, setHoveredUserId] = useState(null);

    // Base path for symmetrical routing (Admin vs Staff)
    const isStaff = window.location.pathname.startsWith('/staff');
    const basePath = isStaff ? '/staff' : '/admin';

    useEffect(() => {
        fetchInitialData();
    }, [activeTab]);

    const fetchInitialData = async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch Ledger Summary
            const sumData = await adminApi.getLedgerSummary({ ledgerType: activeTab });
            if (sumData) {
                const totalYouGave = sumData.totalYouGave !== undefined ? sumData.totalYouGave : (sumData.totalWillGet || 0);
                const totalYouGot = sumData.totalYouGot !== undefined ? sumData.totalYouGot : (sumData.totalWillGive || 0);
                const netBalance = sumData.netBalance !== undefined ? sumData.netBalance : (totalYouGot - totalYouGave);
                setSummary({ netBalance, totalYouGave, totalYouGot });
            } else {
                setSummary({ netBalance: 0, totalYouGave: 0, totalYouGot: 0 });
            }

            // Fetch Customers list
            const custData = await adminApi.getLedgerCustomers({ ledgerType: activeTab });
            setCustomers(custData);

            // Fetch allowed locations mapping
            const locRes = await fetch('/api/locations');
            if (locRes.ok) {
                const locData = await locRes.json();
                setLocations(locData);
            }
        } catch (err) {
            console.error('Error fetching ledger dashboard data:', err);
            setError(err.message || 'Failed to load ledger data.');
        } finally {
            setLoading(false);
        }
    };

    const handleSyncAll = async () => {
        if (!window.confirm('This will recalculate and synchronize the digital ledger for all customers in the database. Proceed?')) return;
        setSyncing(true);
        try {
            await adminApi.syncAllLedgers();
            alert('Ledger synchronization completed successfully!');
            await fetchInitialData();
        } catch (err) {
            alert('Sync failed: ' + err.message);
        } finally {
            setSyncing(false);
        }
    };

    const handleRemoveFromLedger = async (cust) => {
        const userName = cust.user?.name || 'this user';
        const msg = `Are you sure you want to permanently remove ${userName} from the ledger?\n\nThis will reset their ledger balance to zero and permanently delete all their ledger transactions. This action CANNOT be undone.`;
        if (!window.confirm(msg)) return;
        try {
            await adminApi.removeFromLedger(cust.user._id);
            alert(`Successfully removed ${userName} from the ledger.`);
            await fetchInitialData();
        } catch (err) {
            alert('Failed to remove user: ' + err.message);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        if (formSubmittingRef.current) return;
        if (!formName.trim() || !formMobile.trim()) {
            alert('Name and Mobile number are required.');
            return;
        }
        if (!/^\d{10}$/.test(formMobile.trim())) {
            alert('Mobile number must be a 10-digit number.');
            return;
        }
        formSubmittingRef.current = true;
        setFormSubmitting(true);
        try {
            await adminApi.createUser({
                name: formName.trim(),
                mobile: formMobile.trim(),
                altMobile: formAltMobile.trim(),
                email: formEmail.trim(),
                district: formDistrict || (locations && Object.keys(locations)[0]) || '',
                taluk: formTaluk || (locations && formDistrict && locations[formDistrict] && locations[formDistrict][0]) || '',
                address: formAddress.trim(),
                pincode: formPincode.trim(),
                openingBalance: Number(formOpeningBalance) || 0,
                openingBalanceType: formOpeningBalanceType,
                isAddedToLedger: true,
                ledgerType: activeTab
            });
            alert(`${activeTab === 'Customer' ? 'Customer' : 'Supplier'} created and registered to ledger successfully!`);
            setShowCreateModal(false);
            // Reset form
            setFormName('');
            setFormMobile('');
            setIsExistingUserLink(false);
            setSelectedExistingUserId('');
            setFormAltMobile('');
            setFormEmail('');
            setFormDistrict('');
            setFormTaluk('');
            setFormAddress('');
            setFormPincode('');
            setFormOpeningBalance('');
            setFormOpeningBalanceType('debit');
            fetchInitialData();
        } catch (err) {
            alert('Failed to create account: ' + err.message);
        } finally {
            formSubmittingRef.current = false;
            setFormSubmitting(false);
        }
    };

    // Filter customers reactively
    const filteredCustomers = (customers || []).filter(c => {
        if (!c || !c.user) return false;
        
        const name = c.user.name || '';
        const mobile = c.user.mobile || '';
        const matchesSearch = 
            name.toLowerCase().includes(search.toLowerCase()) || 
            mobile.includes(search);
        return matchesSearch;
    });

    if (loading) {
        return (
            <div style={containerStyle}>
                <div style={glassCardStyle}>
                    <div style={spinnerStyle}></div>
                    <p style={{ color: '#64748b', fontWeight: 600, marginTop: '16px' }}>Loading ledger information...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={containerStyle}>
                <div style={errorCardStyle}>
                    <h3 style={{ color: '#ef4444', margin: '0 0 10px' }}>⚠️ Error Loading Ledger</h3>
                    <p style={{ color: '#4b5563', margin: '0 0 20px' }}>{error}</p>
                    <button style={primaryBtnStyle} onClick={fetchInitialData}>Try Again</button>
                </div>
            </div>
        );
    }    return (
        <div style={containerStyle}>
            {/* Dashboard Header */}
            <div style={headerSectionStyle}>
                <div>
                    <h2 style={titleStyle}>📖 Ledger</h2>
                    {/* <p style={subtitleStyle}>Track, reconcile, and manage customer and supplier credit balances and advances.</p> */}
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button 
                        style={createNewBtnStyle}
                        onClick={() => {
                            if (locations && Object.keys(locations).length > 0) {
                                const defaultDist = Object.keys(locations)[0];
                                setFormDistrict(defaultDist);
                                if (locations[defaultDist] && locations[defaultDist].length > 0) {
                                    setFormTaluk(locations[defaultDist][0]);
                                }
                            }
                            setShowCreateModal(true);
                        }}
                    >
                        ➕ Create New {activeTab === 'Customer' ? 'Customer' : 'Supplier'}
                    </button>
                </div>
            </div>

            {/* Elegant glassmorphic tabs */}
            <div style={tabsContainerStyle}>
                <button 
                    style={{
                        ...tabStyle,
                        ...(activeTab === 'Customer' ? activeTabStyle : {})
                    }}
                    onClick={() => setActiveTab('Customer')}
                >
                    👥 Customers Panel
                </button>
                <button 
                    style={{
                        ...tabStyle,
                        ...(activeTab === 'Supplier' ? activeTabStyle : {})
                    }}
                    onClick={() => setActiveTab('Supplier')}
                >
                    🏭 Suppliers Panel
                </button>
            </div>

            {/* Glassmorphic Stats Grid */}
            <div style={statsGridStyle}>
                {/* Net Balance Card */}
                <div style={{
                    ...glassCardStyle,
                    borderLeft: `5px solid ${summary.netBalance >= 0 ? '#10b981' : '#ef4444'}`
                }}>
                    <span style={statLabelStyle}>Net Outstanding Balance</span>
                    <h3 style={{
                        ...statValueStyle,
                        color: summary.netBalance >= 0 ? '#059669' : '#dc2626'
                    }}>
                        ₹{Math.abs(summary.netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <span style={statSubLabelStyle}>
                            {summary.netBalance >= 0 ? ' (To Receive / Got)' : ' (To Pay / Gave)'}
                        </span>
                    </h3>
                </div>

                {/* Total You Gave Card */}
                <div style={{ ...glassCardStyle, borderLeft: '5px solid #dc2626' }}>
                    <span style={statLabelStyle}>Total You Gave</span>
                    <h3 style={{ ...statValueStyle, color: '#dc2626' }}>
                        ₹{summary.totalYouGave.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                </div>

                {/* Total You Got Card */}
                <div style={{ ...glassCardStyle, borderLeft: '5px solid #059669' }}>
                    <span style={statLabelStyle}>Total You Got</span>
                    <h3 style={{ ...statValueStyle, color: '#059669' }}>
                        ₹{summary.totalYouGot.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                </div>
            </div>

            {/* Filter and Table Container */}
            <div style={glassCardStyle}>
                {/* Search & Location Pickers */}
                <div style={filterRowStyle}>
                    <div style={searchWrapperStyle}>
                        <span style={searchIconStyle}>🔍</span>
                        <input
                            type="text"
                            placeholder={`Search ${activeTab === 'Customer' ? 'customers' : 'suppliers'} by name or mobile...`}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={filterInputStyle}
                        />
                    </div>

                </div>

                {/* Ledger Customers Table */}
                <div style={tableWrapperStyle}>
                    <table style={tableStyle}>
                        <thead>
                            <tr style={tableHeaderRowStyle}>
                                <th style={{ ...thStyle, width: '28%' }}>{activeTab === 'Customer' ? 'Customer Details' : 'Supplier Details'}</th>
                                <th style={{ ...thStyle, textAlign: 'right', width: '15%' }}>You Gave</th>
                                <th style={{ ...thStyle, textAlign: 'right', width: '15%' }}>You Got</th>
                                <th style={{ ...thStyle, textAlign: 'right', width: '17%' }}>Net Balance</th>
                                <th style={thStyle}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCustomers.length === 0 ? (
                                <tr>
                                     <td colSpan="5" style={noDataStyle}>
                                         No {activeTab === 'Customer' ? 'customers' : 'suppliers'} matching current filters.
                                     </td>
                                </tr>
                            ) : (
                                filteredCustomers.map((cust) => {
                                     const net = cust.netBalance || 0;
                                     const isYouGave = net < 0;
                                     return (
                                         <tr
                                             key={cust.user?._id || Math.random().toString()}
                                             style={{
                                                 ...trStyle,
                                                 cursor: cust.user?._id ? 'pointer' : 'default',
                                                 backgroundColor: hoveredUserId === cust.user?._id ? '#f8fafc' : 'transparent'
                                             }}
                                             className="ledger-tr"
                                             onMouseEnter={() => setHoveredUserId(cust.user?._id || null)}
                                             onMouseLeave={() => setHoveredUserId(null)}
                                             onClick={() => cust.user?._id && navigate(`${basePath}/ledger/${cust.user._id}`)}
                                         >
                                             <td style={tdStyle}>
                                                  <div style={customerInfoStyle}>
                                                      <span style={custNameStyle}>
                                                          {cust.user?.name || 'Unknown'}
                                                          {(cust.openingBalance || 0) > 0 && (
                                                              <span style={{ fontSize: '11.5px', color: '#64748b', marginLeft: '8px', fontWeight: '600' }}>
                                                                  (OB: ₹{cust.openingBalance.toLocaleString('en-IN')} {cust.openingBalanceType === 'credit' ? 'Cr' : 'Dr'})
                                                              </span>
                                                          )}
                                                      </span>
                                                      <span style={custMobileStyle}>📱 {cust.user?.mobile || 'N/A'}</span>
                                                  </div>
                                             </td>
                                             <td style={{ ...tdStyle, textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>
                                                 ₹{(cust.totalYouGave || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                             </td>
                                             <td style={{ ...tdStyle, textAlign: 'right', color: '#059669', fontWeight: 600 }}>
                                                 ₹{(cust.totalYouGot || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                             </td>
                                             <td style={{ 
                                                 ...tdStyle, 
                                                 textAlign: 'right', 
                                                 color: isYouGave ? '#dc2626' : net > 0 ? '#059669' : '#64748b', 
                                                 fontWeight: 700 
                                             }}>
                                                 ₹{Math.abs(net).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                 <span style={{ fontSize: '11px', fontWeight: 500, marginLeft: '3px' }}>
                                                     {isYouGave ? ' (Gave)' : net > 0 ? ' (Got)' : ''}
                                                 </span>
                                             </td>
                                             <td style={tdStyle}></td>
                                         </tr>
                                     );
                                 })
                             )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* High-end glassmorphic Modal overlay for customer / supplier registration */}
            {showCreateModal && (
                <div style={modalOverlayStyle} onClick={() => setShowCreateModal(false)}>
                    <div style={modalContainerStyle} onClick={(e) => e.stopPropagation()}>
                        <div style={modalHeaderStyle}>
                            <h3 style={modalTitleStyle}>➕ Register New {activeTab === 'Customer' ? 'Customer' : 'Supplier'}</h3>
                            <button style={modalCloseBtnStyle} onClick={() => setShowCreateModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleCreateUser} style={modalFormStyle}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#4f46e5', fontWeight: '700', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={isExistingUserLink}
                                        onChange={(e) => {
                                            setIsExistingUserLink(e.target.checked);
                                            handleSelectExistingUser('');
                                        }}
                                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                    />
                                    🔗 Link Existing Registered User Account
                                </label>
                                {isExistingUserLink && (
                                    <div style={{ ...formFieldStyle, marginTop: '8px' }}>
                                        <label style={labelStyle}>Choose Existing User *</label>
                                        <select 
                                            value={selectedExistingUserId} 
                                            onChange={(e) => handleSelectExistingUser(e.target.value)}
                                            style={selectStyle}
                                            required={isExistingUserLink}
                                        >
                                            <option value="">-- Select User --</option>
                                            {allExistingUsers.map(u => (
                                                <option key={u._id} value={u._id}>
                                                    {u.name || 'No Name'} ({u.mobile})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div style={formGridStyle}>
                                <div style={formFieldStyle}>
                                    <label style={labelStyle}>Full Name *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        value={formName} 
                                        onChange={(e) => setFormName(e.target.value)} 
                                        style={inputStyle}
                                    />
                                </div>
                                <div style={formFieldStyle}>
                                    <label style={labelStyle}>10-Digit Mobile *</label>
                                    <input 
                                        type="text" 
                                        required 
                                        maxLength="10" 
                                        value={formMobile} 
                                        onChange={(e) => setFormMobile(e.target.value.replace(/\D/g, ''))} 
                                        style={inputStyle}
                                    />
                                </div>
                                <div style={formFieldStyle}>
                                    <label style={labelStyle}>Alternative Mobile</label>
                                    <input 
                                        type="text" 
                                        maxLength="10" 
                                        value={formAltMobile} 
                                        onChange={(e) => setFormAltMobile(e.target.value.replace(/\D/g, ''))} 
                                        style={inputStyle}
                                    />
                                </div>
                                <div style={formFieldStyle}>
                                    <label style={labelStyle}>Email Address</label>
                                    <input 
                                        type="email" 
                                        value={formEmail} 
                                        onChange={(e) => setFormEmail(e.target.value)} 
                                        style={inputStyle}
                                    />
                                </div>
                                <div style={formFieldStyle}>
                                    <label style={labelStyle}>District</label>
                                    <select 
                                        value={formDistrict} 
                                        onChange={(e) => {
                                            setFormDistrict(e.target.value);
                                            if (locations && locations[e.target.value] && locations[e.target.value].length > 0) {
                                                setFormTaluk(locations[e.target.value][0]);
                                            } else {
                                                setFormTaluk('');
                                            }
                                        }} 
                                        style={selectStyle}
                                    >
                                        <option value="">Select District</option>
                                        {locations && Object.keys(locations).map(dist => (
                                            <option key={dist} value={dist}>{dist}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={formFieldStyle}>
                                    <label style={labelStyle}>Taluk</label>
                                    <select 
                                        value={formTaluk} 
                                        onChange={(e) => setFormTaluk(e.target.value)} 
                                        style={selectStyle}
                                        disabled={!formDistrict}
                                    >
                                        <option value="">Select Taluk</option>
                                        {formDistrict && locations && locations[formDistrict]?.map(tlk => (
                                            <option key={tlk} value={tlk}>{tlk}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={formFieldStyle}>
                                    <label style={labelStyle}>Pincode</label>
                                    <input 
                                        type="text" 
                                        maxLength="6" 
                                        value={formPincode} 
                                        onChange={(e) => setFormPincode(e.target.value.replace(/\D/g, ''))} 
                                        style={inputStyle}
                                    />
                                </div>
                                <div style={formFieldStyle}>
                                    <label style={labelStyle}>Opening Balance (₹)</label>
                                    <input 
                                        type="number" 
                                        value={formOpeningBalance} 
                                        onChange={(e) => setFormOpeningBalance(e.target.value)} 
                                        style={inputStyle}
                                    />
                                </div>
                                <div style={{ ...formFieldStyle, gridColumn: 'span 2' }}>
                                    <label style={labelStyle}>Address Details</label>
                                    <textarea 
                                        rows="2" 
                                        value={formAddress} 
                                        onChange={(e) => setFormAddress(e.target.value)} 
                                        style={textareaStyle}
                                    />
                                </div>
                            </div>
                            <div style={modalActionsStyle}>
                                <button type="button" onClick={() => setShowCreateModal(false)} style={cancelBtnStyle}>Cancel</button>
                                <button type="submit" disabled={formSubmitting} style={submitBtnStyle}>
                                    {formSubmitting ? 'Registering...' : `Register ${activeTab}`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════
// GLASSMORPHIC INLINE STYLING SYSTEM
// ═══════════════════════════════════════════
const containerStyle = {
    padding: '16px 20px',
    maxWidth: '100%',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    height: '100%',
    overflowY: 'auto'
};

const headerSectionStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px'
};

const titleStyle = {
    margin: 0,
    fontSize: '28px',
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: '-0.5px'
};

const subtitleStyle = {
    margin: '4px 0 0',
    fontSize: '14px',
    color: '#64748b'
};

const syncBtnStyle = {
    background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    color: 'white',
    border: 'none',
    padding: '12px 20px',
    borderRadius: '12px',
    fontWeight: '600',
    fontSize: '14px',
    boxShadow: '0 4px 14px rgba(17, 153, 142, 0.25)',
    transition: 'transform 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
};

const statsGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px'
};

const glassCardStyle = {
    background: 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.6)',
    borderRadius: '16px',
    padding: '16px 20px',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)',
    boxSizing: 'border-box'
};

const errorCardStyle = {
    background: '#fef2f2',
    border: '1px solid #fee2e2',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)',
    textAlign: 'center'
};

const primaryBtnStyle = {
    background: '#11998e',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer'
};

const statLabelStyle = {
    fontSize: '14px',
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
};

const statValueStyle = {
    margin: '12px 0 0',
    fontSize: '32px',
    fontWeight: '800',
    letterSpacing: '-1px',
    display: 'flex',
    alignItems: 'baseline',
    gap: '6px',
    flexWrap: 'wrap'
};

const statSubLabelStyle = {
    fontSize: '14px',
    fontWeight: '500',
    color: '#64748b'
};

const filterRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px',
    marginBottom: '20px'
};

const searchWrapperStyle = {
    position: 'relative',
    flex: '1 1 300px',
    display: 'flex',
    alignItems: 'center'
};

const searchIconStyle = {
    position: 'absolute',
    left: '14px',
    fontSize: '16px',
    color: '#94a3b8'
};

const filterInputStyle = {
    width: '100%',
    padding: '12px 14px 12px 42px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    background: 'white',
    fontSize: '14px',
    color: '#1e293b',
    outline: 'none',
    boxSizing: 'border-box'
};

const tableWrapperStyle = {
    overflowX: 'auto',
    width: '100%'
};

const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left'
};

const tableHeaderRowStyle = {
    borderBottom: '2px solid #e2e8f0'
};

const thStyle = {
    padding: '12px 16px',
    fontSize: '13px',
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
};

const trStyle = {
    borderBottom: '1px solid #f1f5f9',
    transition: 'background-color 0.2s'
};

const tdStyle = {
    padding: '12px 16px',
    fontSize: '14px',
    color: '#334155',
    verticalAlign: 'middle'
};

const customerInfoStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0px'
};

const custNameStyle = {
    fontWeight: '600',
    color: '#0f172a',
    lineHeight: '1.1'
};

const custMobileStyle = {
    fontSize: '12px',
    color: '#64748b'
};

const locationInfoStyle = {
    display: 'flex',
    flexDirection: 'column'
};

const locationTextStyle = {
    fontWeight: '500',
    color: '#334155'
};

const locationSubStyle = {
    fontSize: '12px',
    color: '#94a3b8'
};

const deleteBtnStyle = {
    background: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    padding: '8px 14px',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    outline: 'none'
};

const noDataStyle = {
    textAlign: 'center',
    padding: '40px 16px',
    color: '#64748b',
    fontWeight: '500'
};

const spinnerStyle = {
    width: '40px',
    height: '40px',
    border: '4px solid rgba(17, 153, 142, 0.1)',
    borderTop: '4px solid #11998e',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto'
};

const createNewBtnStyle = {
    background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
    color: 'white',
    border: 'none',
    padding: '12px 20px',
    borderRadius: '12px',
    fontWeight: '600',
    fontSize: '14px',
    boxShadow: '0 4px 14px rgba(79, 70, 229, 0.25)',
    transition: 'transform 0.2s',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    gap: '8px'
};

const tabsContainerStyle = {
    display: 'flex',
    background: 'rgba(241, 245, 249, 0.8)',
    padding: '6px',
    borderRadius: '16px',
    gap: '8px',
    maxWidth: '400px',
    border: '1px solid rgba(226, 232, 240, 0.8)',
};

const tabStyle = {
    flex: 1,
    padding: '10px 16px',
    border: 'none',
    background: 'transparent',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#64748b',
    cursor: 'pointer',
    transition: 'all 0.25s ease',
    outline: 'none',
};

const activeTabStyle = {
    background: 'white',
    color: '#0f172a',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
};

const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.45)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
};

const modalContainerStyle = {
    background: 'rgba(255, 255, 255, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.7)',
    borderRadius: '24px',
    padding: '32px',
    width: '100%',
    maxWidth: '560px',
    maxHeight: '90%',
    overflowY: 'auto',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.15)',
    boxSizing: 'border-box',
};

const modalHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
};

const modalTitleStyle = {
    margin: 0,
    fontSize: '20px',
    fontWeight: '800',
    color: '#0f172a',
};

const modalCloseBtnStyle = {
    border: 'none',
    background: '#f1f5f9',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    color: '#64748b',
    cursor: 'pointer',
    fontWeight: 'bold',
};

const modalFormStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
};

const formGridStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
};

const formFieldStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
};

const labelStyle = {
    fontSize: '12px',
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
};

const inputStyle = {
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    width: '100%',
};

const selectStyle = {
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    background: 'white',
    width: '100%',
    height: '40px',
};

const textareaStyle = {
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    width: '100%',
    fontFamily: 'inherit',
    resize: 'none',
};

const modalActionsStyle = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '12px',
};

const cancelBtnStyle = {
    padding: '10px 20px',
    border: '1px solid #e2e8f0',
    background: 'white',
    borderRadius: '10px',
    fontWeight: '600',
    fontSize: '14px',
    color: '#64748b',
    cursor: 'pointer',
};

const submitBtnStyle = {
    padding: '10px 20px',
    border: 'none',
    background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    borderRadius: '10px',
    fontWeight: '600',
    fontSize: '14px',
    color: 'white',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(17, 153, 142, 0.2)',
};

export default LedgerDashboard;
