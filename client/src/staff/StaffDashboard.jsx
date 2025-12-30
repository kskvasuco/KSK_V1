import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function StaffDashboard() {
    const navigate = useNavigate();

    useEffect(() => {
        // Staff dashboard defaults to showing active/pending orders
        navigate('/staff/pending', { replace: true });
    }, [navigate]);

    return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
            <p>Loading dashboard...</p>
        </div>
    );
}

export default StaffDashboard;
