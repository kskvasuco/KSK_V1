import React from 'react';
import OrderList from './OrderList';

export default function CancelledOrders() {
    return <OrderList status="Cancelled" title="Cancelled Orders" />;
}
