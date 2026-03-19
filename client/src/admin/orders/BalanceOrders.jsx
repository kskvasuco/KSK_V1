import React from 'react';
import { useOutletContext } from 'react-router-dom';
import OrderList from './OrderList';

export default function BalanceOrders() {
    const { refreshTrigger } = useOutletContext() || {};
    return <OrderList status="balance" title="Balance" refreshTrigger={refreshTrigger} />;
}
