import React from 'react';
import OrderList from './OrderList';

export default function PausedOrders() {
    return <OrderList status="Paused" title="Paused Orders" />;
}
