import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import LoginPage from './LoginPage';
import Dashboard from './Dashboard';
import PendingOrders from './orders/PendingOrders';
import RateRequested from './orders/RateRequested';
import RateApproved from './orders/RateApproved';
import ConfirmedOrders from './orders/ConfirmedOrders';
import DispatchOrders from './orders/DispatchOrders';
import BalanceOrders from './orders/BalanceOrders';
import PausedOrders from './orders/PausedOrders';
import HoldOrders from './orders/HoldOrders';
import DeliveredOrders from './orders/DeliveredOrders';
import CancelledOrders from './orders/CancelledOrders';
import ProductList from './products/ProductList';

function AdminApp() {
    return (
        <Routes>
            <Route path="login" element={<LoginPage />} />
            <Route path="/" element={<AdminLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="products" element={<ProductList />} />
                <Route path="pending" element={<PendingOrders />} />
                <Route path="rate-requested" element={<RateRequested />} />
                <Route path="rate-approved" element={<RateApproved />} />
                <Route path="confirmed" element={<ConfirmedOrders />} />
                <Route path="dispatch" element={<DispatchOrders />} />
                <Route path="balance" element={<BalanceOrders />} />
                <Route path="paused" element={<PausedOrders />} />
                <Route path="hold" element={<HoldOrders />} />
                <Route path="delivered" element={<DeliveredOrders />} />
                <Route path="cancelled" element={<CancelledOrders />} />
            </Route>
        </Routes>
    );
}

export default AdminApp;
