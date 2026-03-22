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

    const [editingChargeBatch, setEditingChargeBatch] = useState(null); // Key of the batch being edited
    const [tempChargeAmount, setTempChargeAmount] = useState('');
    const [expandedOrders, setExpandedOrders] = useState([]); // Array of orderIds that are expanded

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
            setAgents(data);
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
            setAgentRecords(data);
            setError(null);
        } catch (err) {
            console.error('Error fetching agent records:', err);
            setError('Failed to load records for this agent.');
        } finally {
            setLoadingRecords(false);
        }
    };



    const handleAgentClick = (agent) => {
        setSelectedAgent(agent);
        fetchAgentRecords(agent._id || 'null');
    };

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

           // Unique key for each batch (Order + Timestamp + Confirmation Status)
           const timestamp = record.deliveredAt || record.deliveryDate || record.createdAt;
           const batchKey = `${new Date(timestamp).getTime()}_${record.isConfirmed}`;
            
            let batch = orderGroup.batches.find(b => b.key === batchKey);
            if (!batch) {
                batch = {
                    key: batchKey,
                    date: timestamp,
                    isConfirmed: record.isConfirmed,
                    receivedAmount: 0,
                    agentCharge: 0,
                    items: []
                };
                orderGroup.batches.push(batch);
            }
            batch.items.push(record);
            batch.receivedAmount += record.receivedAmount || 0;
            batch.agentCharge += record.agentCharge || 0;
        });
        return orderGroups;
    };

    const handleChargeSubmit = async (orderId, batchDate) => {
        try {
            const amount = parseFloat(tempChargeAmount) || 0;
            await adminApi.updateAgentCharge(orderId, batchDate, amount);
            setEditingChargeBatch(null);
            setTempChargeAmount('');
            // Refresh records
            fetchAgentRecords(selectedAgent._id || 'null');
        } catch (err) {
            console.error(err);
            alert(err.message || 'Failed to update charge');
        }
    };

    const handleSetNullCharge = async (orderId, batchDate) => {
        try {
            await adminApi.updateAgentCharge(orderId, batchDate, 0);
            // Refresh records
            fetchAgentRecords(selectedAgent._id || 'null');
        } catch (err) {
            console.error(err);
            alert(err.message || 'Failed to update charge');
        }
    };

    if (loading) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner}></div>
                <p>Loading delivery agents...</p>
            </div>
        );
    }

    const groupedOrders = groupRecordsByOrder(agentRecords);

    return (
        <div className={styles.adminSection}>
            <div className={styles.sectionHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>Delivery Agent Management</h2>
                <button onClick={fetchAgents} className={styles.btnEdit} style={{ padding: '8px 16px' }}>🔄 Refresh</button>
            </div>

            {error && <div className={styles.errorMessage}>{error}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: selectedAgent ? '1fr 2fr' : '1fr', gap: '20px' }}>
                {/* Agents List */}
                <div className={styles.productGrid} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <h3 style={{ fontSize: '18px', marginBottom: '10px' }}>Agents</h3>
                    {agents.length === 0 ? (
                        <p className={styles.emptyState}>No delivery agents found.</p>
                    ) : (
                        agents.map(agent => (
                            <div 
                                key={agent._id || 'unassigned'} 
                                className={styles.orderCard} 
                                style={{ 
                                    cursor: 'pointer', 
                                    border: selectedAgent?._id === agent._id ? '2px solid #11998e' : '1px solid #ddd',
                                    padding: '15px' 
                                }}
                                onClick={() => handleAgentClick(agent)}
                            >
                                <div style={{ fontWeight: '600', fontSize: '16px' }}>{agent.name || 'Unassigned / System'}</div>
                                <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
                                    {agent.mobile && <span>📱 {agent.mobile}</span>}
                                </div>
                                <div style={{ fontSize: '13px', color: '#888', marginTop: '8px' }}>
                                    <span>Total Deliveries: {agent.totalDeliveries || 0}</span>
                                    <div style={{ textAlign: 'right', fontSize: '11px', marginTop: '4px' }}>
                                        Last: {new Date(agent.lastDate).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Agent Detail View */}
                {selectedAgent && (
                    <div className={styles.orderCard} style={{ padding: '20px', background: '#fff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
                            <div>
                                <h3 style={{ margin: 0, color: '#11998e' }}>Activity History: {selectedAgent.name}</h3>
                                <p style={{ margin: '5px 0 0 0', color: '#666' }}>Agent ID/Key: {selectedAgent._id || 'System'}</p>
                            </div>
                            <button onClick={() => setSelectedAgent(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#333' }}>✕</button>
                        </div>

                        {loadingRecords ? (
                            <div className={styles.loadingContainer}>
                                <div className={styles.loadingSpinner}></div>
                                <p>Loading history...</p>
                            </div>
                        ) : groupedOrders.length === 0 ? (
                            <p className={styles.emptyState}>No activity found for this agent.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                                {groupedOrders.map((orderGroup) => {
                                    const isExpanded = expandedOrders.includes(orderGroup.orderId);
                                    return (
                                        <div key={orderGroup.orderId} style={{ border: '1px solid #11998e', borderRadius: '10px', padding: '15px', background: '#f0f9f8', marginBottom: '15px' }}>
                                            <div 
                                                onClick={() => toggleOrderExpansion(orderGroup.orderId)}
                                                style={{ 
                                                    display: 'flex', 
                                                    justifyContent: 'space-between', 
                                                    alignItems: 'center',
                                                    cursor: 'pointer',
                                                    paddingBottom: isExpanded ? '10px' : '0',
                                                    borderBottom: isExpanded ? '1px solid #11998e' : 'none',
                                                    marginBottom: isExpanded ? '15px' : '0'
                                                }}
                                            >
                                                <div>
                                                    <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#11998e' }}>Order: {orderGroup.customOrderId}</span>
                                                    <span style={{ marginLeft: '15px', fontSize: '14px', color: '#444' }}>{orderGroup.customer} ({orderGroup.mobile})</span>
                                                </div>
                                                <div style={{ fontSize: '18px', color: '#11998e', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                                    ▼
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                                    {orderGroup.batches.map((batch) => (
                                                        <div key={batch.key} style={{ border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden', background: '#fff' }}>
                                                            {/* Batch Header */}
                                                            <div style={{ 
                                                                background: batch.isConfirmed ? '#f8f9fa' : '#fff9e6', 
                                                                padding: '10px 15px', 
                                                                display: 'flex', 
                                                                justifyContent: 'space-between', 
                                                                alignItems: 'center',
                                                                borderBottom: '1px solid #eee'
                                                            }}>
                                                                <div style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>
                                                                    {new Date(batch.date).toLocaleString('en-IN', {
                                                                        dateStyle: 'medium',
                                                                        timeStyle: 'short'
                                                                    })}
                                                                </div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                                    {/* Rent / Charge Area */}
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                        {editingChargeBatch === batch.key ? (
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                                <input 
                                                                                    type="number" 
                                                                                    value={tempChargeAmount}
                                                                                    onChange={(e) => setTempChargeAmount(e.target.value)}
                                                                                    placeholder="Amt"
                                                                                    style={{ width: '60px', padding: '2px 5px', fontSize: '12px', border: '1px solid #11998e', borderRadius: '4px' }}
                                                                                    autoFocus
                                                                                />
                                                                                <button 
                                                                                    onClick={() => handleChargeSubmit(orderGroup.orderId, batch.date)}
                                                                                    style={{ background: '#11998e', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '12px' }}
                                                                                >
                                                                                    Save
                                                                                </button>
                                                                                <button 
                                                                                    onClick={() => setEditingChargeBatch(null)}
                                                                                    style={{ background: '#ccc', color: '#333', border: 'none', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '12px' }}
                                                                                >
                                                                                    ✕
                                                                                </button>
                                                                            </div>
                                                                        ) : (
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                <div style={{ fontSize: '13px', fontWeight: 'bold', color: batch.agentCharge > 0 ? '#11998e' : '#999' }}>
                                                                                    Rent: <span className={styles.rupee}>₹</span>{ (batch.agentCharge * (orderGroup.batches.find(b => b.key === batch.key)?.items.length || 1)).toFixed(2) }
                                                                                </div>
                                                                                <button 
                                                                                    onClick={() => {
                                                                                        setEditingChargeBatch(batch.key);
                                                                                        setTempChargeAmount((batch.agentCharge * (orderGroup.batches.find(b => b.key === batch.key)?.items.length || 1)).toString());
                                                                                    }}
                                                                                    style={{ background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', padding: '1px 5px', fontSize: '11px' }}
                                                                                >
                                                                                    ✎
                                                                                </button>
                                                                                <button 
                                                                                    onClick={() => handleSetNullCharge(orderGroup.orderId, batch.date)}
                                                                                    style={{ background: '#fee', border: '1px solid #ecc', color: '#c33', borderRadius: '4px', cursor: 'pointer', padding: '1px 5px', fontSize: '11px' }}
                                                                                    title="Clear Rent"
                                                                                >
                                                                                    Null
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {batch.isConfirmed ? (
                                                                        <span style={{ 
                                                                            color: '#28a745', 
                                                                            fontSize: '11px', 
                                                                            fontWeight: 'bold', 
                                                                            background: '#e8f5e9', 
                                                                            padding: '4px 10px', 
                                                                            borderRadius: '12px',
                                                                            border: '1px solid #c8e6c9'
                                                                        }}>
                                                                            CONFIRMED {batch.receivedAmount > 0 ? <>(<span className={styles.rupee}>₹</span>{batch.receivedAmount.toFixed(2)})</> : ''}
                                                                        </span>
                                                                    ) : (
                                                                        <span style={{ 
                                                                            color: '#e67e22', 
                                                                            fontSize: '11px', 
                                                                            fontWeight: 'bold', 
                                                                            background: '#fff3e0', 
                                                                            padding: '4px 10px', 
                                                                            borderRadius: '12px',
                                                                            border: '1px solid #ffe0b2'
                                                                        }}>
                                                                            PENDING
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {/* Batch Items */}
                                                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                                                                <tbody>
                                                                    {batch.items.map((record) => (
                                                                        <tr key={record._id} style={{ borderBottom: '1px solid #f9f9f9' }}>
                                                                            <td style={{ padding: '6px 15px', color: '#333' }}>{record.product?.name || 'Deleted Product'}</td>
                                                                            <td style={{ padding: '6px 15px', textAlign: 'right', fontWeight: '600', color: '#11998e' }}>
                                                                                {record.quantityDelivered} {record.product?.unit}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default DeliveryAgentManagement;
