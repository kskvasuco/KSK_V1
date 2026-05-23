import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import adminApi from './adminApi';

function LedgerDashboard() {
    const navigate = useNavigate();
    const [summary, setSummary] = useState({ netBalance: 0, totalYouGave: 0, totalYouGot: 0 });
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters state
    const [search, setSearch] = useState('');
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [selectedTaluk, setSelectedTaluk] = useState('');
    const [locations, setLocations] = useState({});

    // Bulk sync state
    const [syncing, setSyncing] = useState(false);

    // Base path for symmetrical routing (Admin vs Staff)
    const isStaff = window.location.pathname.startsWith('/staff');
    const basePath = isStaff ? '/staff' : '/admin';

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch Ledger Summary
            const sumData = await adminApi.getLedgerSummary();
            if (sumData) {
                const totalYouGave = sumData.totalYouGave !== undefined ? sumData.totalYouGave : (sumData.totalWillGet || 0);
                const totalYouGot = sumData.totalYouGot !== undefined ? sumData.totalYouGot : (sumData.totalWillGive || 0);
                const netBalance = sumData.netBalance !== undefined ? sumData.netBalance : (totalYouGot - totalYouGave);
                setSummary({ netBalance, totalYouGave, totalYouGot });
            } else {
                setSummary({ netBalance: 0, totalYouGave: 0, totalYouGot: 0 });
            }

            // Fetch Customers list
            const custData = await adminApi.getLedgerCustomers();
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

    // Filter customers reactively
    const filteredCustomers = (customers || []).filter(c => {
        if (!c || !c.user) return false;
        
        const name = c.user.name || '';
        const mobile = c.user.mobile || '';
        const district = c.user.district || '';
        const taluk = c.user.taluk || '';

        const matchesSearch = 
            name.toLowerCase().includes(search.toLowerCase()) || 
            mobile.includes(search);
        
        const matchesDistrict = !selectedDistrict || district.toLowerCase() === selectedDistrict.toLowerCase();
        const matchesTaluk = !selectedTaluk || taluk.toLowerCase() === selectedTaluk.toLowerCase();

        return matchesSearch && matchesDistrict && matchesTaluk;
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
    }

    return (
        <div style={containerStyle}>
            {/* Dashboard Header */}
            <div style={headerSectionStyle}>
                <div>
                    <h2 style={titleStyle}>📖 Digital KSK Ledger</h2>
                    <p style={subtitleStyle}>Track, reconcile, and manage customer credit balances and advances.</p>
                </div>
                <button 
                    style={{
                        ...syncBtnStyle,
                        opacity: syncing ? 0.7 : 1,
                        cursor: syncing ? 'not-allowed' : 'pointer'
                    }} 
                    onClick={handleSyncAll}
                    disabled={syncing}
                >
                    {syncing ? '🔄 Syncing...' : '🔄 Re-Sync All Ledgers'}
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
                    <span style={statLabelStyle}>Total You Gave (Outstanding Debt)</span>
                    <h3 style={{ ...statValueStyle, color: '#dc2626' }}>
                        ₹{summary.totalYouGave.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                </div>

                {/* Total You Got Card */}
                <div style={{ ...glassCardStyle, borderLeft: '5px solid #059669' }}>
                    <span style={statLabelStyle}>Total You Got (Advance Credit)</span>
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
                            placeholder="Search by name or mobile..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={filterInputStyle}
                        />
                    </div>

                    <div style={selectGroupStyle}>
                        <select
                            value={selectedDistrict}
                            onChange={(e) => {
                                setSelectedDistrict(e.target.value);
                                setSelectedTaluk('');
                            }}
                            style={filterSelectStyle}
                        >
                            <option value="">All Districts</option>
                            {Object.keys(locations).map(dist => (
                                <option key={dist} value={dist}>{dist}</option>
                            ))}
                        </select>

                        <select
                            value={selectedTaluk}
                            onChange={(e) => setSelectedTaluk(e.target.value)}
                            style={{
                                ...filterSelectStyle,
                                opacity: selectedDistrict ? 1 : 0.6,
                                cursor: selectedDistrict ? 'pointer' : 'not-allowed'
                            }}
                            disabled={!selectedDistrict}
                        >
                            <option value="">All Taluks</option>
                            {selectedDistrict && locations[selectedDistrict]?.map(taluk => (
                                <option key={taluk} value={taluk}>{taluk}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Ledger Customers Table */}
                <div style={tableWrapperStyle}>
                    <table style={tableStyle}>
                        <thead>
                            <tr style={tableHeaderRowStyle}>
                                <th style={thStyle}>Customer Details</th>
                                <th style={thStyle}>Location</th>
                                <th style={thStyle}>Last Active</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>You Gave</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>You Got</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Net Balance</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCustomers.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={noDataStyle}>
                                        No customers matching current filters.
                                    </td>
                                </tr>
                            ) : (
                                filteredCustomers.map((cust) => {
                                     const net = cust.netBalance || 0;
                                     const isYouGave = net < 0;
                                     return (
                                         <tr key={cust.user?._id || Math.random().toString()} style={trStyle} className="ledger-tr">
                                             <td style={tdStyle}>
                                                 <div style={customerInfoStyle}>
                                                     <span style={custNameStyle}>{cust.user?.name || 'Unknown'}</span>
                                                     <span style={custMobileStyle}>📱 {cust.user?.mobile || 'N/A'}</span>
                                                 </div>
                                             </td>
                                             <td style={tdStyle}>
                                                 <div style={locationInfoStyle}>
                                                     <span style={locationTextStyle}>{cust.user?.district || 'N/A'}</span>
                                                     <span style={locationSubStyle}>{cust.user?.taluk || ''}</span>
                                                 </div>
                                             </td>
                                             <td style={tdStyle}>
                                                 {cust.lastTransactionDate 
                                                     ? new Date(cust.lastTransactionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
                                                     : 'No entries'
                                                 }
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
                                             <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                 <button 
                                                     style={viewBtnStyle} 
                                                     disabled={!cust.user?._id}
                                                     onClick={() => cust.user?._id && navigate(`${basePath}/ledger/${cust.user._id}`)}
                                                 >
                                                     📖 Open Ledger
                                                 </button>
                                             </td>
                                         </tr>
                                     );
                                 })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════
// GLASSMORPHIC INLINE STYLING SYSTEM
// ═══════════════════════════════════════════
const containerStyle = {
    padding: '24px',
    maxWidth: '1280px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
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
    padding: '24px',
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

const selectGroupStyle = {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    flex: '1 1 auto',
    justifyContent: 'flex-end'
};

const filterSelectStyle = {
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    background: 'white',
    fontSize: '14px',
    color: '#1e293b',
    outline: 'none',
    minWidth: '160px',
    cursor: 'pointer'
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
    padding: '14px 16px',
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
    padding: '16px',
    fontSize: '14px',
    color: '#334155',
    verticalAlign: 'middle'
};

const customerInfoStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
};

const custNameStyle = {
    fontWeight: '600',
    color: '#0f172a'
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

const viewBtnStyle = {
    background: 'rgba(17, 153, 142, 0.1)',
    color: '#11998e',
    border: '1px solid rgba(17, 153, 142, 0.2)',
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

export default LedgerDashboard;
