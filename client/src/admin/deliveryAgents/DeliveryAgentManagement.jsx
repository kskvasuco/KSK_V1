import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import adminApi from '../adminApi';
import styles from '../adminStyles.module.css';

function DeliveryAgentManagement() {
    const { refreshTrigger } = useOutletContext();
    const [agents, setAgents] = useState([]);
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [agentRecords, setAgentRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const [editingChargeBatch, setEditingChargeBatch] = useState(null); // Key of the batch being edited
    const [tempChargeAmount, setTempChargeAmount] = useState('');
    const [expandedOrders, setExpandedOrders] = useState([]); // Array of orderIds that are expanded
    const [viewItemsBatch, setViewItemsBatch] = useState(null); // Batch whose items are being viewed in popup

    // Confirm Cash Modal states
    const [showConfirmCashModal, setShowConfirmCashModal] = useState(false);
    const [confirmCashBatch, setConfirmCashBatch] = useState(null);
    const [confirmCashAmount, setConfirmCashAmount] = useState('');
    const [confirmCashMode, setConfirmCashMode] = useState('Cash');
    const [confirmCashDate, setConfirmCashDate] = useState('');
    const [editingExpectedBatch, setEditingExpectedBatch] = useState(null);
    const [tempExpectedAmount, setTempExpectedAmount] = useState('');
    const [editingDateBatch, setEditingDateBatch] = useState(null);
    const [tempConfirmDate, setTempConfirmDate] = useState('');

    // Add Agent Modal states
    const [showAddModal, setShowAddModal] = useState(false);
    const [newAgentForm, setNewAgentForm] = useState({
        name: '',
        mobile: '',
        description: '',
        address: ''
    });
    const [isCreatingAgent, setIsCreatingAgent] = useState(false);

    useEffect(() => {
        fetchAgents();
    }, [refreshTrigger]);

    useEffect(() => {
        if (selectedAgent) {
            fetchAgentRecords(selectedAgent._id || 'null');
        }
    }, [refreshTrigger, selectedAgent?._id]);

    const fetchAgents = async () => {
        setLoading(true);
        try {
            const data = await adminApi.getDeliveryAgents();
            setAgents(data || []);
            setError(null);
        } catch (err) {
            console.error('Error fetching agents:', err);
            setError('Failed to load delivery agents.');
        } finally {
            setLoading(false);
        }
    };

    const fetchAgentRecords = async (agentId) => {
        setLoadingRecords(true);
        try {
            const data = await adminApi.getAgentRecords(agentId);
            setAgentRecords(data || []);
            setError(null);
        } catch (err) {
            console.error('Error fetching agent records:', err);
            setError('Failed to load records for this agent.');
        } finally {
            setLoadingRecords(false);
        }
    };

    const handleCreateAgent = async (e) => {
        e.preventDefault();
        if (!newAgentForm.name.trim()) {
            alert('Agent name is required');
            return;
        }
        try {
            setIsCreatingAgent(true);
            await adminApi.createDeliveryAgent(newAgentForm);
            alert('Agent created successfully!');
            setShowAddModal(false);
            setNewAgentForm({ name: '', mobile: '', description: '', address: '' });
            fetchAgents();
        } catch (err) {
            console.error(err);
            alert(err.message || 'Failed to create agent');
        } finally {
            setIsCreatingAgent(false);
        }
    };

    const handleClearAgent = async () => {
        if (!selectedAgent) return;
        const confirmMsg = `Are you sure you want to completely clear agent "${selectedAgent.name}" from the system?\n\nThis will remove them from all active orders and update historical records to "Unassigned".`;
        if (window.confirm(confirmMsg)) {
            try {
                await adminApi.clearDeliveryAgent(selectedAgent._id || selectedAgent.name);
                alert('Agent cleared successfully!');
                setSelectedAgent(null);
                fetchAgents();
            } catch (err) {
                console.error(err);
                alert(err.message || 'Failed to clear agent.');
            }
        }
    };

    const handleAgentClick = (agent) => {
        setSelectedAgent(agent);
        fetchAgentRecords(agent._id || 'null');
    };

    const cleanName = (val) => val ? val.replace(/\s*-\s*\d{2}-\d{2}-\d{4}$/, '') : '';

    const toggleOrderExpansion = (orderId) => {
        setExpandedOrders(prev => 
            prev.includes(orderId) 
                ? prev.filter(id => id !== orderId) 
                : [...prev, orderId]
        );
    };

    const groupRecordsByOrder = (records) => {
        const orderGroups = [];
        records.forEach(record => {
            const orderObj = record.order || {};
            const orderId = orderObj._id || 'unknown';
            
            let orderGroup = orderGroups.find(og => og.orderId === orderId);
            if (!orderGroup) {
                orderGroup = {
                    orderId: orderId,
                    customOrderId: orderObj.customOrderId || 'N/A',
                    customer: orderObj.user?.name || 'Unknown',
                    mobile: orderObj.user?.mobile || '',
                    batches: []
                };
                orderGroups.push(orderGroup);
            }

            const timestamp = record.deliveredAt || record.deliveryDate || record.createdAt;
            const batchKey = `${new Date(timestamp).getTime()}_${record.isConfirmed}`;
            
            let batch = orderGroup.batches.find(b => b.key === batchKey);
            if (!batch) {
                batch = {
                    key: batchKey,
                    date: timestamp,
                    confirmedAt: record.confirmedAt || null,
                    isConfirmed: record.isConfirmed,
                    paymentMode: record.paymentMode || null,
                    receivedAmount: 0,
                    expectedAmount: 0,
                    agentCharge: 0,
                    items: []
                };
                orderGroup.batches.push(batch);
            }
            batch.items.push(record);
            batch.receivedAmount += record.receivedAmount || 0;
            batch.expectedAmount += record.expectedAmount || 0;
            batch.agentCharge += record.agentCharge || 0;
            if (record.paymentMode) {
                batch.paymentMode = record.paymentMode;
            }
        });
        return orderGroups;
    };

    const handleChargeSubmit = async (orderId, batchDate) => {
        try {
            const amount = parseFloat(tempChargeAmount) || 0;
            await adminApi.updateAgentCharge(orderId, batchDate, amount);
            setEditingChargeBatch(null);
            setTempChargeAmount('');
            fetchAgentRecords(selectedAgent._id || 'null');
        } catch (err) {
            console.error(err);
            alert(err.message || 'Failed to update charge');
        }
    };

    const handleSetNullCharge = async (orderId, batchDate) => {
        try {
            await adminApi.updateAgentCharge(orderId, batchDate, 0);
            fetchAgentRecords(selectedAgent._id || 'null');
        } catch (err) {
            console.error(err);
            alert(err.message || 'Failed to update charge');
        }
    };

    const handleCloseBatchWithCash = (orderId, batchDate) => {
        const batch = allBatches.find(b => b.orderId === orderId && b.date === batchDate);
        if (!batch) return;
        setConfirmCashBatch(batch);
        setConfirmCashAmount((batch.agentCharge * batch.items.length).toString());
        setConfirmCashMode('Cash');
        
        // Initialize with current local time formatted for input type="datetime-local" (YYYY-MM-DDTHH:mm)
        const dt = new Date();
        const tzOffset = dt.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(dt.getTime() - tzOffset)).toISOString().slice(0, 16);
        setConfirmCashDate(localISOTime);
        
        setShowConfirmCashModal(true);
    };

    const submitConfirmCash = async (e) => {
        e.preventDefault();
        if (!confirmCashBatch) return;
        const amount = parseFloat(confirmCashAmount) || 0;
        const confirmedDateStr = confirmCashDate ? new Date(confirmCashDate).toISOString() : new Date().toISOString();
        try {
            await adminApi.confirmDeliveryBatch(confirmCashBatch.orderId, confirmCashBatch.date, amount, amount === 0, confirmCashMode, confirmedDateStr);
            setShowConfirmCashModal(false);
            setConfirmCashBatch(null);
            fetchAgentRecords(selectedAgent._id || 'null');
        } catch (err) {
            console.error(err);
            alert(err.message || 'Failed to confirm batch cash');
        }
    };

    const handleExpectedSubmit = async (orderId, batchDate) => {
        try {
            await adminApi.updateExpectedAmount(orderId, batchDate, parseFloat(tempExpectedAmount) || 0);
            setEditingExpectedBatch(null);
            fetchAgentRecords(selectedAgent._id || 'null');
        } catch (err) {
            console.error(err);
            alert(err.message || 'Failed to update expected amount');
        }
    };

    const handleDateSubmit = async (orderId, batchDate) => {
        try {
            await adminApi.updateConfirmationDate(orderId, batchDate, new Date(tempConfirmDate).toISOString());
            setEditingDateBatch(null);
            fetchAgentRecords(selectedAgent._id || 'null');
        } catch (err) {
            console.error(err);
            alert(err.message || 'Failed to update confirmation date');
        }
    };

    const handleCloseBatchNoCash = async (orderId, batchDate) => {
        if (window.confirm("Close this batch's balance with NO cash entry?")) {
            try {
                await adminApi.confirmDeliveryBatch(orderId, batchDate, 0, true, null);
                alert('Batch balance closed (no cash) successfully!');
                fetchAgentRecords(selectedAgent._id || 'null');
            } catch (err) {
                console.error(err);
                alert(err.message || 'Failed to close batch');
            }
        }
    };

    const filteredAgents = agents.filter(agent => {
        const name = (agent.name || '').toLowerCase();
        const mobile = (agent.mobile || '').toLowerCase();
        const query = searchQuery.toLowerCase();
        return name.includes(query) || mobile.includes(query);
    });

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '12px' }}>
                <div style={{ width: '32px', height: '32px', border: '2.5px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Loading directory...</p>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    const groupedOrders = groupRecordsByOrder(agentRecords);

    const allBatches = [];
    groupedOrders.forEach(orderGroup => {
        orderGroup.batches.forEach(batch => {
            allBatches.push({
                ...batch,
                orderId: orderGroup.orderId,
                customOrderId: orderGroup.customOrderId,
                customer: orderGroup.customer
            });
        });
    });
    allBatches.sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '16px 24px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.5px' }}>
                        Delivery Agents
                    </h2>
                    <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13.5px' }}>Overview of active delivery personnel, logs, and billing adjustments.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                        onClick={() => setShowAddModal(true)} 
                        style={{ 
                            padding: '8px 16px', 
                            borderRadius: '8px', 
                            fontWeight: '600', 
                            fontSize: '12.5px',
                            background: 'rgba(99, 102, 241, 0.08)', 
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            border: '1px solid rgba(99, 102, 241, 0.25)', 
                            color: '#4f46e5',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.05)'
                        }}
                        onMouseOver={e => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)'; e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.35)'; }}
                        onMouseOut={e => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)'; e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.25)'; }}
                    >
                        + Add Agent
                    </button>
                    <button 
                        onClick={fetchAgents} 
                        style={{ 
                            padding: '8px 16px', 
                            borderRadius: '8px', 
                            fontWeight: '550', 
                            fontSize: '12.5px',
                            background: 'rgba(255, 255, 255, 0.4)', 
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            border: '1px solid rgba(226, 232, 240, 0.8)', 
                            color: '#475569',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)'
                        }}
                        onMouseOver={e => { e.currentTarget.style.background = 'rgba(248, 250, 252, 0.8)'; e.currentTarget.style.borderColor = 'rgba(226, 232, 240, 1)'; }}
                        onMouseOut={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.4)'; e.currentTarget.style.borderColor = 'rgba(226, 232, 240, 0.8)'; }}
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '13px', padding: '10px 14px', borderRadius: '6px', marginBottom: '20px' }}>{error}</div>}

            {/* Content Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: selectedAgent ? '290px 1fr' : '1fr', gap: '28px', alignItems: 'start' }}>
                
                {/* List Directory */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <input
                        type="text"
                        placeholder="Filter by name or phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                            fontSize: '13.5px',
                            outline: 'none',
                            transition: 'border-color 0.15s ease',
                            backgroundColor: '#fafcfd',
                            boxSizing: 'border-box'
                        }}
                        onFocus={e => e.target.style.borderColor = '#6366f1'}
                        onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                    />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '65vh', overflowY: 'auto' }}>
                        {filteredAgents.length === 0 ? (
                            <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '24px 0', border: '1px dashed #e2e8f0', borderRadius: '6px' }}>No matches found</p>
                        ) : (
                            filteredAgents.map(agent => {
                                const isSelected = selectedAgent?._id === agent._id || (agent.name && selectedAgent?.name === agent.name);
                                return (
                                    <div 
                                        key={agent._id || 'unassigned'} 
                                        style={{ 
                                            cursor: 'pointer', 
                                            borderRadius: '6px',
                                            border: '1px solid ' + (isSelected ? '#6366f1' : '#e2e8f0'),
                                            backgroundColor: isSelected ? '#faf5ff' : '#fff',
                                            padding: '12px 14px',
                                            transition: 'all 0.15s ease',
                                        }}
                                        onClick={() => handleAgentClick(agent)}
                                        onMouseOver={e => !isSelected && (e.currentTarget.style.backgroundColor = '#f8fafc')}
                                        onMouseOut={e => !isSelected && (e.currentTarget.style.backgroundColor = '#fff')}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: '600', fontSize: '14px', color: '#1e293b' }}>
                                                {agent.name || 'System / Unassigned'}
                                            </span>
                                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
                                                {agent.totalDeliveries || 0} trips
                                            </span>
                                        </div>
                                        {agent.mobile && (
                                            <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '4px' }}>
                                                {agent.mobile}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right Panel Detail Logs */}
                {selectedAgent ? (
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                        
                        {/* Detail View Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px', marginBottom: '20px' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '750', color: '#0f172a' }}>
                                    {selectedAgent.name}
                                </h3>
                                {selectedAgent.mobile && <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13px' }}>Phone: {selectedAgent.mobile}</p>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <button 
                                    onClick={handleClearAgent}
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.08)',
                                        backdropFilter: 'blur(8px)',
                                        WebkitBackdropFilter: 'blur(8px)',
                                        color: '#ef4444',
                                        border: '1px solid rgba(239, 68, 68, 0.25)',
                                        borderRadius: '8px',
                                        padding: '6px 14px',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.04)'
                                    }}
                                    onMouseOver={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.35)'; }}
                                    onMouseOut={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)'; }}
                                >
                                    Remove Agent Registry
                                </button>
                                <button 
                                    onClick={() => setSelectedAgent(null)} 
                                    style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px', color: '#94a3b8' }}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {loadingRecords ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                                <div style={{ width: '24px', height: '24px', border: '2px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                            </div>
                                              ) : allBatches.length === 0 ? (
                            <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13.5px', padding: '40px 0' }}>No activity records on file.</p>
                        ) : (
                            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.015)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                                    <thead>
                                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                            <th style={{ padding: '12px 14px', fontWeight: '650', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date</th>
                                            <th style={{ padding: '12px 14px', fontWeight: '650', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Order</th>
                                            <th style={{ padding: '12px 14px', fontWeight: '650', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Items</th>
                                            <th style={{ padding: '12px 14px', fontWeight: '650', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rent</th>
                                            <th style={{ padding: '12px 14px', fontWeight: '650', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cash</th>
                                            <th style={{ padding: '12px 14px', fontWeight: '650', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status & Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allBatches.map((batch, index) => {
                                            const d = new Date(batch.date);
                                            const day = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                                            const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

                                            const itemsStr = batch.items.map(record => 
                                                `${cleanName(record.name || record.product?.name || 'Custom Product')} (${record.quantityDelivered} ${record.product?.unit || record.unit})`
                                            ).join(', ');

                                            return (
                                                <tr key={batch.key} style={{ borderBottom: '1px solid #f1f5f9', background: index % 2 === 0 ? '#fff' : '#fafbfd' }}>
                                                    {/* Date */}
                                                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                                                        <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '13px' }}>{day}</div>
                                                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{time}</div>
                                                    </td>

                                                    {/* Order */}
                                                    <td style={{ padding: '10px 14px', color: '#1e293b', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                                                        <div style={{ fontWeight: '600', color: '#0f172a' }}>{batch.customOrderId}</div>
                                                        <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>({batch.customer})</div>
                                                    </td>

                                                    {/* Items */}
                                                    <td 
                                                        style={{ 
                                                            padding: '10px 14px', 
                                                            color: '#4f46e5', 
                                                            maxWidth: '200px', 
                                                            overflow: 'hidden', 
                                                            textOverflow: 'ellipsis', 
                                                            whiteSpace: 'nowrap', 
                                                            verticalAlign: 'top',
                                                            cursor: 'pointer',
                                                            textDecoration: 'underline',
                                                            fontWeight: '500'
                                                        }} 
                                                        onClick={() => setViewItemsBatch(batch)}
                                                        title="Click to view all items"
                                                    >
                                                        {itemsStr}
                                                    </td>

                                                    {/* Rent */}
                                                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                                                        {editingChargeBatch === batch.key ? (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                <input 
                                                                    type="number" 
                                                                    value={tempChargeAmount}
                                                                    onChange={(e) => setTempChargeAmount(e.target.value)}
                                                                    style={{ width: '60px', padding: '4px 6px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', outline: 'none' }}
                                                                    autoFocus
                                                                />
                                                                <div style={{ display: 'flex', gap: '3px' }}>
                                                                    <button 
                                                                        onClick={() => handleChargeSubmit(batch.orderId, batch.date)}
                                                                        style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}
                                                                    >
                                                                        Save
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => setEditingChargeBatch(null)}
                                                                        style={{ background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '4px', padding: '4px 6px', cursor: 'pointer', fontSize: '11px' }}
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                                                <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: '600' }}>
                                                                    ₹{(batch.agentCharge * batch.items.length).toFixed(0)}
                                                                </span>
                                                                <button 
                                                                    onClick={() => {
                                                                        setEditingChargeBatch(batch.key);
                                                                        setTempChargeAmount((batch.agentCharge * batch.items.length).toString());
                                                                    }}
                                                                    style={{ 
                                                                        background: 'rgba(99, 102, 241, 0.05)', 
                                                                        border: '1px solid rgba(99, 102, 241, 0.18)', 
                                                                        borderRadius: '4px', 
                                                                        padding: '3px 8px', 
                                                                        fontSize: '11px', 
                                                                        cursor: 'pointer', 
                                                                        fontWeight: '600', 
                                                                        color: '#4f46e5',
                                                                        transition: 'all 0.15s ease'
                                                                    }}
                                                                    onMouseOver={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'}
                                                                    onMouseOut={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)'}
                                                                    title="Edit Rent"
                                                                >
                                                                    ✏️ Edit
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleSetNullCharge(batch.orderId, batch.date)}
                                                                    style={{ 
                                                                        background: 'rgba(239, 68, 68, 0.04)', 
                                                                        border: '1px solid rgba(239, 68, 68, 0.15)', 
                                                                        borderRadius: '4px', 
                                                                        padding: '3px 8px', 
                                                                        fontSize: '11px', 
                                                                        cursor: 'pointer', 
                                                                        fontWeight: '600', 
                                                                        color: '#ef4444',
                                                                        transition: 'all 0.15s ease'
                                                                    }}
                                                                    onMouseOver={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
                                                                    onMouseOut={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.04)'}
                                                                    title="Clear Rent"
                                                                >
                                                                    ✕ Clear
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Cash */}
                                                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                                                        <div style={{ fontSize: '12.5px', color: '#475569', fontWeight: '500', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                            {batch.isConfirmed ? (
                                                                <>
                                                                    <div style={{ color: '#059669', fontWeight: '600' }}>
                                                                        Coll: ₹{batch.receivedAmount.toFixed(0)}
                                                                        {batch.paymentMode && (
                                                                            <span style={{ marginLeft: '6px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(5, 150, 105, 0.08)', fontSize: '10px', fontWeight: '700' }}>{batch.paymentMode}</span>
                                                                        )}
                                                                    </div>
                                                                    {batch.confirmedAt && (
                                                                        editingDateBatch === batch.key ? (
                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                                                                                <input 
                                                                                    type="datetime-local" 
                                                                                    value={tempConfirmDate}
                                                                                    onChange={(e) => setTempConfirmDate(e.target.value)}
                                                                                    style={{ fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 4px', outline: 'none' }}
                                                                                    autoFocus
                                                                                />
                                                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                                                    <button 
                                                                                        onClick={() => handleDateSubmit(batch.orderId, batch.date)}
                                                                                        style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: '3px', padding: '2px 6px', fontSize: '10px', cursor: 'pointer', fontWeight: '600' }}
                                                                                    >
                                                                                        Save
                                                                                    </button>
                                                                                    <button 
                                                                                        onClick={() => setEditingDateBatch(null)}
                                                                                        style={{ background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '3px', padding: '2px 4px', fontSize: '10px', cursor: 'pointer' }}
                                                                                    >
                                                                                        ✕
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <div 
                                                                                style={{ fontSize: '10.5px', color: '#4f46e5', marginTop: '2px', cursor: 'pointer', textDecoration: 'underline' }}
                                                                                onClick={() => {
                                                                                    setEditingDateBatch(batch.key);
                                                                                    const dt = new Date(batch.confirmedAt);
                                                                                    const tzOffset = dt.getTimezoneOffset() * 60000;
                                                                                    const localISOTime = (new Date(dt.getTime() - tzOffset)).toISOString().slice(0, 16);
                                                                                    setTempConfirmDate(localISOTime);
                                                                                }}
                                                                                title="Click to edit date"
                                                                            >
                                                                                On: {new Date(batch.confirmedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} {new Date(batch.confirmedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                                            </div>
                                                                        )
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <div style={{ color: '#d97706', fontSize: '11.5px' }}>Pending</div>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Status & Actions */}
                                                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                                                            {batch.isConfirmed ? (
                                                                <span style={{ 
                                                                    fontSize: '11px', 
                                                                    fontWeight: '700', 
                                                                    color: '#059669',
                                                                    background: 'rgba(5, 150, 105, 0.08)',
                                                                    padding: '3px 8px',
                                                                    borderRadius: '4px',
                                                                    textTransform: 'uppercase'
                                                                }}>
                                                                    Confirmed
                                                                </span>
                                                            ) : (
                                                                <>
                                                                    <span style={{ 
                                                                        fontSize: '11px', 
                                                                        fontWeight: '700', 
                                                                        color: '#d97706',
                                                                        background: 'rgba(217, 119, 6, 0.08)',
                                                                        padding: '3px 8px',
                                                                        borderRadius: '4px',
                                                                        textTransform: 'uppercase'
                                                                    }}>
                                                                        Pending
                                                                    </span>
                                                                    <button 
                                                                        onClick={() => handleCloseBatchWithCash(batch.orderId, batch.date)}
                                                                        style={{ 
                                                                            background: 'rgba(99, 102, 241, 0.06)', 
                                                                            border: '1px solid rgba(99, 102, 241, 0.2)', 
                                                                            borderRadius: '4px', 
                                                                            padding: '4px 8px', 
                                                                            fontSize: '11px', 
                                                                            cursor: 'pointer', 
                                                                            fontWeight: '600', 
                                                                            color: '#4f46e5',
                                                                            transition: 'all 0.15s ease'
                                                                        }}
                                                                        onMouseOver={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.12)'}
                                                                        onMouseOut={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.06)'}
                                                                    >
                                                                        💰 Pay
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleCloseBatchNoCash(batch.orderId, batch.date)}
                                                                        style={{ 
                                                                            background: 'rgba(239, 68, 68, 0.05)', 
                                                                            border: '1px solid rgba(239, 68, 68, 0.18)', 
                                                                            borderRadius: '4px', 
                                                                            padding: '4px 8px', 
                                                                            fontSize: '11px', 
                                                                            cursor: 'pointer', 
                                                                            fontWeight: '600', 
                                                                            color: '#ef4444',
                                                                            transition: 'all 0.15s ease'
                                                                        }}
                                                                        onMouseOver={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                                                                        onMouseOut={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)'}
                                                                    >
                                                                        ✓ Close
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ border: '1px dashed #cbd5e1', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
                        <span style={{ fontSize: '28px', marginBottom: '8px' }}>🚛</span>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#64748b' }}>No Agent Selected</h4>
                        <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', maxWidth: '280px', color: '#94a3b8' }}>Choose a delivery agent from the list to view logs, settle rents, or update records.</p>
                    </div>
                )}
            </div>

            {/* Create Agent Modal Popup */}
            {showAddModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowAddModal(false)}>
                    <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '24px', width: '380px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>Create Delivery Agent</h3>
                        <form onSubmit={handleCreateAgent} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={newAgentForm.name}
                                    onChange={e => setNewAgentForm({ ...newAgentForm, name: e.target.value })}
                                    placeholder="e.g. John Doe"
                                    style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13.5px', outline: 'none' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Mobile Number</label>
                                <input
                                    type="tel"
                                    value={newAgentForm.mobile}
                                    onChange={e => setNewAgentForm({ ...newAgentForm, mobile: e.target.value.replace(/\D/g, '').slice(0,10) })}
                                    placeholder="10-digit phone number"
                                    style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13.5px', outline: 'none' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Vehicle / Description</label>
                                <input
                                    type="text"
                                    value={newAgentForm.description}
                                    onChange={e => setNewAgentForm({ ...newAgentForm, description: e.target.value })}
                                    placeholder="e.g. KA-02-1234, TATA Ace"
                                    style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13.5px', outline: 'none' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Address</label>
                                <textarea
                                    value={newAgentForm.address}
                                    onChange={e => setNewAgentForm({ ...newAgentForm, address: e.target.value })}
                                    placeholder="Physical address"
                                    rows="2"
                                    style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13.5px', outline: 'none', resize: 'none', fontFamily: 'inherit' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '8px', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setShowAddModal(false)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#fff', fontSize: '12.5px', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" disabled={isCreatingAgent} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#6366f1', color: '#fff', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', opacity: isCreatingAgent ? 0.7 : 1 }}>
                                    {isCreatingAgent ? 'Creating...' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* View Items Popup Modal */}
            {viewItemsBatch && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setViewItemsBatch(null)}>
                    <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '24px', width: '400px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>Delivered Products</h3>
                        <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#64748b' }}>
                            Order ID: <strong style={{ color: '#0f172a' }}>{viewItemsBatch.customOrderId}</strong> ({viewItemsBatch.customer})
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', paddingVertical: '12px', marginBottom: '16px' }}>
                            {viewItemsBatch.items.map((record) => (
                                <div key={record._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', padding: '6px 8px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                                    <span style={{ fontWeight: '600', color: '#334155' }}>{cleanName(record.name || record.product?.name || 'Custom Product')}</span>
                                    <span style={{ color: '#64748b', fontWeight: '500' }}>{record.quantityDelivered} {record.product?.unit || record.unit}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button type="button" onClick={() => setViewItemsBatch(null)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '12.5px', fontWeight: '600', color: '#334155', cursor: 'pointer' }}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Cash Popup Modal */}
            {showConfirmCashModal && confirmCashBatch && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowConfirmCashModal(false)}>
                    <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '24px', width: '380px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>Confirm Cash Collection</h3>
                        <p style={{ margin: '0 0 16px 0', fontSize: '12.5px', color: '#64748b' }}>
                            Expected Amount: <strong style={{ color: '#0f172a' }}>₹{confirmCashBatch.expectedAmount.toFixed(0)}</strong>
                        </p>
                        <form onSubmit={submitConfirmCash} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Payment Method *</label>
                                <select
                                    value={confirmCashMode}
                                    onChange={e => setConfirmCashMode(e.target.value)}
                                    style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13.5px', outline: 'none', backgroundColor: '#fff' }}
                                >
                                    <option value="Cash">Cash</option>
                                    <option value="GPay">GPay</option>
                                    <option value="PhonePe">PhonePe</option>
                                    <option value="Bank Transfer">Bank Transfer</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Date *</label>
                                <input
                                    type="datetime-local"
                                    required
                                    value={confirmCashDate}
                                    onChange={e => setConfirmCashDate(e.target.value)}
                                    style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13.5px', outline: 'none' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Collected Amount (₹) *</label>
                                <input
                                    type="number"
                                    required
                                    value={confirmCashAmount}
                                    onChange={e => setConfirmCashAmount(e.target.value)}
                                    placeholder="Enter cash collected"
                                    style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13.5px', outline: 'none' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '8px', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setShowConfirmCashModal(false)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#fff', fontSize: '12.5px', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#6366f1', color: '#fff', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer' }}>
                                    💰 Confirm
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DeliveryAgentManagement;
