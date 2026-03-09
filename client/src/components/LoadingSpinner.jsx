import './LoadingSpinner.css';

export default function LoadingSpinner({ message = 'Loading...' }) {
    return (
        <div className="loading-overlay">
            <div className="loading-container">
                <div className="simple-spinner"></div>
                <h2 className="loading-title">Building Your Experience...</h2>
                <p className="loading-brand">KSK VASU & Co</p>
            </div>
        </div>
    );
}
