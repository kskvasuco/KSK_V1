import './LoadingSpinner.css';

export default function LoadingSpinner({ message = 'Loading...' }) {
    return (
        <div className="loading-overlay">
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>{message}</p>
            </div>
        </div>
    );
}
