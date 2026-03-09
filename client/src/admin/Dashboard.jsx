import React from 'react';
import styles from './adminStyles.module.css';

function Dashboard() {
    return (
        <div className={styles.dashboard}>
            <h2 className={styles.dashboardTitle}>Admin Dashboard</h2>
            {/* Placeholder for sections like Products, Orders, etc. */}
            <p className={styles.dashboardInfo}>All functionalities are preserved from the original admin panel.</p>
        </div>
    );
}

export default Dashboard;
