import React, { useState, useEffect, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import adminApi from './adminApi';
import styles from './adminStyles.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function rupee(amount) {
    if (!amount) return '—';
    return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pdfRupee(amount) {
    if (!amount) return '—';
    return `Rs. ${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateDisplay(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getLocalDateString(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getGroupInfo(dateStr, groupBy) {
    const d = new Date(dateStr);
    if (groupBy === 'None') return { key: 'All', title: 'Statement Details' };
    if (groupBy === 'Daily') {
        const key = getLocalDateString(d);
        const title = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
        return { key, title };
    }
    if (groupBy === 'Monthly') {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const title = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        return { key, title };
    }
    if (groupBy === 'Weekly') {
        d.setHours(0,0,0,0);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const start = new Date(d);
        start.setDate(diff);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        
        const key = getLocalDateString(start);
        const title = `${start.toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'})} to ${end.toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'})}`;
        return { key, title };
    }
}

function isDateInRange(dateStr, filterMode, customStart, customEnd) {
    if (filterMode === 'All') return true;
    
    const d = new Date(dateStr);
    d.setHours(0,0,0,0);
    const time = d.getTime();
    
    const now = new Date();
    now.setHours(0,0,0,0);
    
    if (filterMode === 'Today') {
        return time === now.getTime();
    }
    if (filterMode === 'ThisWeek') {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const start = new Date(now);
        start.setDate(diff);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        return time >= start.getTime() && time <= end.getTime();
    }
    if (filterMode === 'ThisMonth') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
        return time >= start && time <= end;
    }
    if (filterMode === 'Custom') {
        if (customStart) {
            const s = new Date(customStart + 'T00:00:00');
            s.setHours(0,0,0,0);
            if (time < s.getTime()) return false;
        }
        if (customEnd) {
            const e = new Date(customEnd + 'T00:00:00');
            e.setHours(23,59,59,999);
            if (time > e.getTime()) return false;
        }
        return true;
    }
    return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const inputStyle = {
    padding: '9px 14px',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    fontSize: 13,
    color: '#1e293b',
    outline: 'none',
    background: '#fff',
    minWidth: 140,
    fontFamily: 'inherit',
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
};

const thStyle = {
    padding: '14px 24px',
    background: '#f8fafc',
    color: '#475569',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '2px solid #cbd5e1'
};

const tdStyle = {
    padding: '14px 24px',
    fontSize: 14,
    color: '#1e293b',
    verticalAlign: 'middle'
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function Report() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Filters state
    const [dateFilter, setDateFilter] = useState('All'); // All, Today, ThisWeek, ThisMonth, Custom
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [groupBy, setGroupBy] = useState('Daily'); // Daily, Weekly, Monthly, None
    const [sortDir, setSortDir] = useState('desc'); // desc, asc
    const [searchQuery, setSearchQuery] = useState('');

    const fetchOrders = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await adminApi.getOrders();
            setOrders(data.orders || []);
        } catch (err) {
            console.error('Error fetching orders:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchOrders(); }, []);

    // ── Pre-process raw adjustments ───────────────────────────────────────────
    const baseRows = useMemo(() => {
        const map = {};
        orders.forEach(order => {
            if (!Array.isArray(order.adjustments)) return;
            order.adjustments.forEach(adj => {
                if (adj.type === 'advance' || adj.type === 'payment') {
                    // Aggregate by exact date and orderId
                    const d = new Date(adj.date);
                    const dateKey = getLocalDateString(d);
                    const rowKey = `${dateKey}_${order._id}`;
                    
                    if (!map[rowKey]) {
                        map[rowKey] = {
                            id: rowKey,
                            date: adj.date,
                            dateKey: dateKey,
                            orderId: order._id,
                            customOrderId: order.customOrderId || order._id,
                            customerName: order.user?.name || 'Unknown',
                            customerMobile: order.user?.mobile || '',
                            advance: 0,
                            payment: 0,
                        };
                    }
                    if (adj.type === 'advance') map[rowKey].advance += adj.amount;
                    if (adj.type === 'payment') map[rowKey].payment += adj.amount;
                }
            });
        });
        return Object.values(map);
    }, [orders]);

    // ── Filter and Group ──────────────────────────────────────────────────────
    const filteredAndGrouped = useMemo(() => {
        // 1. Filter by date and search
        let filtered = baseRows.filter(r => isDateInRange(r.date, dateFilter, startDate, endDate));
        
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(r => 
                r.customOrderId?.toLowerCase().includes(q) ||
                r.customerName?.toLowerCase().includes(q) ||
                r.customerMobile?.includes(q)
            );
        }

        // 2. Group
        const groupsMap = {};
        filtered.forEach(row => {
            const { key, title } = getGroupInfo(row.date, groupBy);
            if (!groupsMap[key]) {
                groupsMap[key] = {
                    key,
                    title,
                    rows: [],
                    advance: 0,
                    payment: 0,
                    total: 0
                };
            }
            groupsMap[key].rows.push(row);
            groupsMap[key].advance += row.advance;
            groupsMap[key].payment += row.payment;
            groupsMap[key].total += (row.advance + row.payment);
        });

        // 3. Sort groups
        let groupsArray = Object.values(groupsMap);
        groupsArray.sort((a, b) => {
            if (a.key === 'All') return 0;
            return sortDir === 'desc' ? b.key.localeCompare(a.key) : a.key.localeCompare(b.key);
        });

        // 4. Sort rows within groups
        groupsArray.forEach(g => {
            g.rows.sort((a, b) => {
                const da = new Date(a.date).getTime();
                const db = new Date(b.date).getTime();
                return sortDir === 'desc' ? db - da : da - db;
            });
        });

        return groupsArray;
    }, [baseRows, dateFilter, startDate, endDate, searchQuery, groupBy, sortDir]);

    // ── Totals ────────────────────────────────────────────────────────────────
    const grandAdvance = useMemo(() => filteredAndGrouped.reduce((s, g) => s + g.advance, 0), [filteredAndGrouped]);
    const grandPayment = useMemo(() => filteredAndGrouped.reduce((s, g) => s + g.payment, 0), [filteredAndGrouped]);
    const grandTotal = grandAdvance + grandPayment;

    const downloadPDF = () => {
        const doc = new jsPDF();
        
        doc.setFontSize(16);
        doc.text("KSK VASU & Co", 14, 15);
        doc.setFontSize(12);
        doc.text("Statement of Transactions", 14, 22);
        
        doc.setFontSize(10);
        let periodTextPDF = 'All Time';
        if (dateFilter === 'Today') periodTextPDF = 'Today';
        if (dateFilter === 'ThisWeek') periodTextPDF = 'This Week';
        if (dateFilter === 'ThisMonth') periodTextPDF = 'This Month';
        if (dateFilter === 'Custom') {
            const s = startDate ? formatDateDisplay(startDate) : '...';
            const e = endDate ? formatDateDisplay(endDate) : '...';
            periodTextPDF = `${s} to ${e}`;
        }

        doc.text(`Period: ${periodTextPDF}`, 14, 28);
        doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 14, 34);
        
        const tableBody = [];
        
        filteredAndGrouped.forEach(group => {
            if (groupBy !== 'None' && groupBy !== 'Daily') {
                tableBody.push([
                    { content: group.title, colSpan: 6, styles: { fillColor: [241, 245, 249], fontStyle: 'bold', textColor: [30, 41, 59] } }
                ]);
            }
            
            group.rows.forEach(row => {
                tableBody.push([
                    formatDateDisplay(row.date),
                    row.customOrderId,
                    `${row.customerName}\n${row.customerMobile || ''}`,
                    pdfRupee(row.advance),
                    pdfRupee(row.payment),
                    pdfRupee(row.advance + row.payment)
                ]);
            });
            
            if (groupBy !== 'None') {
                tableBody.push([
                    { content: `Subtotal for ${group.title}`, colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
                    { content: pdfRupee(group.advance), styles: { halign: 'right', fontStyle: 'bold', textColor: [2, 132, 199] } },
                    { content: pdfRupee(group.payment), styles: { halign: 'right', fontStyle: 'bold', textColor: [22, 163, 74] } },
                    { content: pdfRupee(group.total), styles: { halign: 'right', fontStyle: 'bold' } }
                ]);
            }
        });
        
        tableBody.push([
            { content: 'GRAND TOTAL', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', fillColor: [236, 253, 245], textColor: [6, 78, 59] } },
            { content: pdfRupee(grandAdvance), styles: { halign: 'right', fontStyle: 'bold', fillColor: [236, 253, 245], textColor: [2, 132, 199] } },
            { content: pdfRupee(grandPayment), styles: { halign: 'right', fontStyle: 'bold', fillColor: [236, 253, 245], textColor: [22, 163, 74] } },
            { content: pdfRupee(grandTotal), styles: { halign: 'right', fontStyle: 'bold', fillColor: [236, 253, 245], textColor: [6, 95, 70] } }
        ]);

        autoTable(doc, {
            startY: 40,
            head: [['Date', 'Order ID', 'Particulars', 'Advance', 'Payment', 'Total']],
            body: tableBody,
            headStyles: { fillColor: [17, 153, 142], textColor: [255, 255, 255], fontStyle: 'bold' },
            columnStyles: {
                3: { halign: 'right' },
                4: { halign: 'right' },
                5: { halign: 'right' }
            },
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 3 }
        });
        const pdfBlobUrl = doc.output('bloburl');
        window.open(pdfBlobUrl, '_blank');
    };

    // Display Text for Period
    let periodText = 'All Time';
    if (dateFilter === 'Today') periodText = 'Today';
    if (dateFilter === 'ThisWeek') periodText = 'This Week';
    if (dateFilter === 'ThisMonth') periodText = 'This Month';
    if (dateFilter === 'Custom') {
        const s = startDate ? formatDateDisplay(startDate) : '...';
        const e = endDate ? formatDateDisplay(endDate) : '...';
        periodText = `${s} to ${e}`;
    }

    if (loading) return (
        <div className={styles.adminSection}>
            <h3>📄 Statement of Accounts</h3>
            <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner}></div>
                <p>Loading records...</p>
            </div>
        </div>
    );

    if (error) return (
        <div className={styles.adminSection}>
            <h3>📄 Statement of Accounts</h3>
            <p style={{ color: '#ef4444' }}>Error: {error}</p>
            <button onClick={fetchOrders} className={styles.btnConfirm}>Retry</button>
        </div>
    );

    return (
        <div className={styles.adminSection}>
            
            {/* ══ Header ═══════════════════════════════════════════════════════ */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>
                        📄 Statement of Accounts
                    </h3>
                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
                        Detailed ledger of advances and payments
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={downloadPDF}
                        style={{
                            padding: '9px 18px',
                            background: '#fff',
                            border: '1.5px solid #cbd5e1',
                            borderRadius: 10,
                            color: '#475569',
                            cursor: 'pointer',
                            fontSize: 13,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}
                    >
                        📥 Download PDF
                    </button>
                    <button
                        onClick={fetchOrders}
                        style={{
                            padding: '9px 18px',
                            background: '#f0f9ff',
                            border: '1.5px solid #bae6fd',
                            borderRadius: 10,
                            color: '#0284c7',
                            cursor: 'pointer',
                            fontSize: 13,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        🔄 Refresh Data
                    </button>
                </div>
            </div>

            {/* ══ Controls / Filters ═══════════════════════════════════════════ */}
            <div style={{
                background: '#fff',
                padding: '18px 24px',
                borderRadius: 14,
                border: '1px solid #e2e8f0',
                marginBottom: 24,
                boxShadow: '0 2px 14px rgba(0,0,0,0.03)'
            }}>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    
                    {/* Period Selector */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>Period</label>
                        <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={inputStyle}>
                            <option value="All">All Time</option>
                            <option value="Today">Today</option>
                            <option value="ThisWeek">This Week</option>
                            <option value="ThisMonth">This Month</option>
                            <option value="Custom">Custom Range...</option>
                        </select>
                    </div>

                    {/* Custom Range Inputs */}
                    {dateFilter === 'Custom' && (
                        <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>From</label>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>To</label>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
                            </div>
                        </>
                    )}

                    {/* Group By Selector */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>Group By</label>
                        <select value={groupBy} onChange={e => setGroupBy(e.target.value)} style={inputStyle}>
                            <option value="Daily">Daily</option>
                            <option value="Weekly">Weekly</option>
                            <option value="Monthly">Monthly</option>
                            <option value="None">None (Flat Statement)</option>
                        </select>
                    </div>

                    {/* Sort Selector */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>Sort</label>
                        <select value={sortDir} onChange={e => setSortDir(e.target.value)} style={inputStyle}>
                            <option value="desc">Newest First</option>
                            <option value="asc">Oldest First</option>
                        </select>
                    </div>

                    {/* Search Input */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 200 }}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>Search</label>
                        <input
                            type="text"
                            placeholder="Search Order ID, Name or Phone..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ ...inputStyle, width: '100%' }}
                        />
                    </div>
                </div>
            </div>

            {/* ══ Statement Table UI ═══════════════════════════════════════════ */}
            <div style={{
                background: '#fff',
                borderRadius: 16,
                border: '1px solid #e2e8f0',
                boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
                overflow: 'hidden'
            }}>
                {/* Statement Header */}
                <div style={{
                    padding: '28px 32px',
                    borderBottom: '3px solid #11998e',
                    background: '#f8fafc',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 16
                }}>
                    <div>
                        <h4 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
                            Statement of Transactions
                        </h4>
                        <div style={{ fontSize: 13, color: '#64748b', marginTop: 6, fontWeight: 500 }}>
                            Period: <strong style={{ color: '#334155' }}>{periodText}</strong>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right', background: '#fff', padding: '12px 24px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>
                            Closing Balance
                        </div>
                        <div style={{ fontSize: 26, fontWeight: 800, color: '#11998e', letterSpacing: '-0.5px' }}>
                            {rupee(grandTotal)}
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr>
                                <th style={thStyle}>Date</th>
                                <th style={thStyle}>Order ID</th>
                                <th style={thStyle}>Particulars</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Advance</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Payment</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAndGrouped.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '60px 20px', textAlign: 'center' }}>
                                        <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
                                        <div style={{ fontSize: 15, fontWeight: 600, color: '#475569' }}>No transactions found for the selected period.</div>
                                        <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Try adjusting your date filters or search query.</div>
                                    </td>
                                </tr>
                            ) : (
                                filteredAndGrouped.map(group => (
                                    <React.Fragment key={group.key}>
                                        
                                        {/* Group Header */}
                                        {groupBy !== 'None' && groupBy !== 'Daily' && (
                                            <tr>
                                                <td colSpan={6} style={{
                                                    background: '#f1f5f9',
                                                    padding: '12px 24px',
                                                    fontWeight: 800,
                                                    color: '#1e293b',
                                                    fontSize: 13,
                                                    borderBottom: '1px solid #cbd5e1',
                                                    borderTop: '1px solid #cbd5e1',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: 0.5
                                                }}>
                                                    {group.title}
                                                </td>
                                            </tr>
                                        )}

                                        {/* Rows */}
                                        {group.rows.map((row, i) => (
                                            <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'} onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa'}>
                                                <td style={{...tdStyle, color: '#475569', fontSize: 13}}>
                                                    {formatDateDisplay(row.date)}
                                                </td>
                                                <td style={{ ...tdStyle, fontWeight: 700, color: '#1a73e8', letterSpacing: '-0.2px' }}>
                                                    {row.customOrderId}
                                                </td>
                                                <td style={tdStyle}>
                                                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{row.customerName}</div>
                                                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{row.customerMobile || '—'}</div>
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'right', color: '#0284c7', fontWeight: row.advance ? 700 : 400 }}>
                                                    {rupee(row.advance)}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'right', color: '#16a34a', fontWeight: row.payment ? 700 : 400 }}>
                                                    {rupee(row.payment)}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                                                    {rupee(row.advance + row.payment)}
                                                </td>
                                            </tr>
                                        ))}

                                        {/* Group Subtotal */}
                                        {groupBy !== 'None' && (
                                            <tr>
                                                <td colSpan={3} style={{ padding: '14px 24px', textAlign: 'right', fontWeight: 600, color: '#64748b', fontSize: 13, background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                                    Subtotal for {group.title}
                                                </td>
                                                <td style={{ padding: '14px 24px', textAlign: 'right', fontWeight: 800, color: '#0284c7', background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                                    {rupee(group.advance)}
                                                </td>
                                                <td style={{ padding: '14px 24px', textAlign: 'right', fontWeight: 800, color: '#16a34a', background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                                    {rupee(group.payment)}
                                                </td>
                                                <td style={{ padding: '14px 24px', textAlign: 'right', fontWeight: 800, color: '#0f172a', background: '#f8fafc', borderBottom: '2px solid #e2e8f0', fontSize: 15 }}>
                                                    {rupee(group.total)}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                        
                        {/* Grand Total Footer */}
                        {filteredAndGrouped.length > 0 && (
                            <tfoot>
                                <tr>
                                    <td colSpan={3} style={{ padding: '18px 24px', textAlign: 'right', fontWeight: 800, color: '#064e3b', fontSize: 14, background: '#ecfdf5', borderTop: '3px solid #10b981', letterSpacing: 0.5 }}>
                                        GRAND TOTAL
                                    </td>
                                    <td style={{ padding: '18px 24px', textAlign: 'right', fontWeight: 800, color: '#0284c7', background: '#ecfdf5', borderTop: '3px solid #10b981', fontSize: 15 }}>
                                        {rupee(grandAdvance)}
                                    </td>
                                    <td style={{ padding: '18px 24px', textAlign: 'right', fontWeight: 800, color: '#16a34a', background: '#ecfdf5', borderTop: '3px solid #10b981', fontSize: 15 }}>
                                        {rupee(grandPayment)}
                                    </td>
                                    <td style={{ padding: '18px 24px', textAlign: 'right', fontWeight: 900, color: '#065f46', fontSize: 18, background: '#ecfdf5', borderTop: '3px solid #10b981' }}>
                                        {rupee(grandTotal)}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
}
