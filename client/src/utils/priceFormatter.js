export const formatPrice = (amount) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return amount || '';

    // Check if it's an integer
    if (Number.isInteger(num)) {
        return num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    }

    // If it has decimals, show exactly 2
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
