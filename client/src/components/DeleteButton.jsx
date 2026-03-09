import './DeleteButton.css';

export default function DeleteButton({ onClick }) {
    return (
        <button
            className="delete-btn-red"
            onClick={onClick}
            type="button"
        >
            X
        </button>
    );
}
