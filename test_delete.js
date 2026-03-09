const f = async () => {
    try {
        const res = await fetch('http://localhost:5500/api/admin/orders/12345', { method: 'DELETE' });
        const text = await res.text();
        console.log('Status:', res.status);
        console.log('Headers:', res.headers);
        console.log('Body:', text.substring(0, 500));
    } catch (e) {
        console.error('Error:', e);
    }
};
f();
