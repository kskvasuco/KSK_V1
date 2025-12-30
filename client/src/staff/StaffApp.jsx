import React from 'react';
import { Routes, Route } from 'react-router-dom';
import StaffLayout from './StaffLayout';
import StaffLogin from './StaffLogin';
import StaffProductList from './products/StaffProductList';
import StaffUserList from './users/StaffUserList';
import StaffCreateOrder from './orders/StaffCreateOrder';
// We will create these placeholder components next
import StaffDashboard from './StaffDashboard';
import StaffOrderList from './orders/StaffOrderList';

function StaffApp() {
    return (
        <Routes>
            <Route path="login" element={<StaffLogin />} />
            <Route path="/" element={<StaffLayout />}>
                <Route index element={<StaffDashboard />} />
                <Route path="users" element={<StaffUserList />} />
                <Route path="create-order" element={<StaffCreateOrder />} />
                {/* Reusing the same structure as Admin for simplicity, but we will use StaffOrderList */}
                {/* Note: We pass 'status' as prop to StaffOrderList */}
                <Route path="pending" element={<StaffOrderList status="pending" title="Active Orders" />} />
                <Route path="rate-requested" element={<StaffOrderList status="rate-request" title="Rate Requested Orders" />} />
                <Route path="rate-approved" element={<StaffOrderList status="rate-approved" title="Rate Approved Orders" />} />
                <Route path="confirmed" element={<StaffOrderList status="confirmed" title="Confirmed Orders" />} />
                <Route path="dispatch" element={<StaffOrderList status="dispatch" title="Dispatch Orders" />} />
                <Route path="balance" element={<StaffOrderList status="balance" title="Balance View" />} />
                <Route path="paused" element={<StaffOrderList status="paused" title="Paused Orders" />} />
                <Route path="hold" element={<StaffOrderList status="hold" title="Hold Orders" />} />
                <Route path="delivered" element={<StaffOrderList status="delivered" title="Delivered Orders" />} />
                <Route path="cancelled" element={<StaffOrderList status="cancelled" title="Cancelled Orders" />} />

                {/* Placeholders for future - can comment out or implement placeholders */}
                <Route path="products" element={<div style={{ padding: '20px' }}><h3>Products View (Read Only) - Coming Soon</h3></div>} />
                <Route path="create-order" element={<div style={{ padding: '20px' }}><h3>Create Order - Coming Soon</h3></div>} />
                <Route path="users" element={<div style={{ padding: '20px' }}><h3>Visited Users - Coming Soon</h3></div>} />
            </Route>
        </Routes>
    );
}

export default StaffApp;
