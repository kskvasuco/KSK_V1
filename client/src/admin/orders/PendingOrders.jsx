import React from 'react';
import OrderList from './OrderList';

export default function PendingOrders() {
    return <OrderList status="pending" title="Active Orders" />;
}
