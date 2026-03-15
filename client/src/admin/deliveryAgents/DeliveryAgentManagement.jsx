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

    const [confirmingBatch, setConfirmingBatch] = useState(null); // { orderId, date, amount }
    const [confirmAmount, setConfirmAmount] = useState('');

    const handleAgentClick = (agent) => {
        setSelectedAgent(agent);
        fetchAgentRecords(agent._id || 'null');
    };

    const handleConfirmClick = (batch) => {
        setConfirmingBatch(batch);
        setConfirmAmount('');
    };

    const submitConfirmation = async (batch, isNull) => {
        try {
            const orderId = batch.items[0].order._id;
            await adminApi.confirmDeliveryBatch(
                orderId, 
                batch.date, 
                isNull ? 0 : parseFloat(confirmAmount) || 0,
                isNull
            );
            setConfirmingBatch(null);
            fetchAgentRecords(selectedAgent._id || 'null');
        } catch (err) {
            console.error('Error confirming batch:', err);
            alert('Failed to confirm batch: ' + err.message);
        }
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

           // Unique key for each batch (Order + Date + Confirmation Status)
        const batchKey = `${new Date(record.deliveredAt).getTime()}_${record.isConfirmed}`;
            
            let batch = orderGroup.batches.find(b => b.key === batchKey);
            if (!batch) {
                batch = {
                    key: batchKey,
                    date: record.deliveryDate,
                    isConfirmed: record.isConfirmed,
                    receivedAmount: record.receivedAmount || 0,
                    items: []
                };
                orderGroup.batches.push(batch);
            }
            batch.items.push(record);
        });
        return orderGroups;
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
                            <button onClick={() => setSelectedAgent(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px' }}>✕</button>
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
                                {groupedOrders.map((orderGroup) => (
                                    <div key={orderGroup.orderId} style={{ border: '1px solid #11998e', borderRadius: '10px', padding: '15px', background: '#f0f9f8' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', borderBottom: '1px solid #11998e', paddingBottom: '10px' }}>
                                            <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#11998e' }}>Order: {orderGroup.customOrderId}</div>
                                            <div style={{ fontSize: '14px', color: '#444' }}>{orderGroup.customer} ({orderGroup.mobile})</div>
                                        </div>

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
                                                        <div style={{ fontSize: '13px', color: '#555' }}>
                                                            {new Date(batch.date).toLocaleString()}
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            {batch.isConfirmed ? (
                                                                <span style={{ color: '#666', fontSize: '11px', fontWeight: 'bold', background: '#eee', padding: '2px 8px', borderRadius: '12px' }}>
                                                                    CONFIRMED {batch.receivedAmount > 0 ? `(₹${batch.receivedAmount})` : ''}
                                                                </span>
                                                            ) : (
                                                                <>
                                                                    {confirmingBatch?.key === batch.key ? (
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                            <input 
                                                                                type="number" 
                                                                                placeholder="Amt" 
                                                                                value={confirmAmount}
                                                                                onChange={(e) => setConfirmAmount(e.target.value)}
                                                                                style={{ width: '60px', padding: '2px 5px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '4px' }}
                                                                            />
                                                                            <button onClick={() => submitConfirmation(batch, false)} style={{ background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 8px', fontSize: '12px', cursor: 'pointer' }}>OK</button>
                                                                            <button onClick={() => setConfirmingBatch(null)} style={{ background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 8px', fontSize: '12px', cursor: 'pointer' }}>✕</button>
                                                                        </div>
                                                                    ) : (
                                                                        <div style={{ display: 'flex', gap: '5px' }}>
                                                                            <button 
                                                                                onClick={() => handleConfirmClick(batch)}
                                                                                title="Confirm with Payment"
                                                                                style={{ background: '#fff', border: '1px solid #28a745', color: '#28a745', borderRadius: '4px', width: '28px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 'bold' }}
                                                                            >✓</button>
                                                                            <button 
                                                                                onClick={() => submitConfirmation(batch, true)}
                                                                                title="Null (No Payment)"
                                                                                style={{ background: '#fff', border: '1px solid #dc3545', color: '#dc3545', borderRadius: '4px', padding: '0 5px', fontSize: '11px', cursor: 'pointer' }}
                                                                            >Null</button>
                                                                        </div>
                                                                    )}
                                                                </>
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
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default DeliveryAgentManagement;
