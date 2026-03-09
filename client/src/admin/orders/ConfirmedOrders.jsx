import React from 'react';
import OrderList from './OrderList';

export default function ConfirmedOrders() {
    return <OrderList status="confirmed" title="Confirmed Orders" />;
}
