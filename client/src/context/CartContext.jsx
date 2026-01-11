import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import * as api from '../services/api';

const CartContext = createContext(null);

export function CartProvider({ children }) {
    const { isAuthenticated } = useAuth();
    const [cart, setCart] = useState([]);
    const [editContext, setEditContext] = useState(null);
    const [loading, setLoading] = useState(false);

    // Function to check and load edit order from session storage
    const checkForEditOrder = useCallback(() => {
        const orderDataString = sessionStorage.getItem('orderToEdit');
        if (orderDataString && !editContext) {
            try {
                const orderData = JSON.parse(orderDataString);
                if (orderData.orderId && orderData.items) {
                    setEditContext({ orderId: orderData.orderId });
                    setCart(orderData.items.map(item => ({
                        ...item,
                        quantity: parseFloat(item.quantity)
                    })));
                    return true;
                }
            } catch (e) {
                console.error('Failed to parse order data', e);
                sessionStorage.removeItem('orderToEdit');
            }
        }
        return false;
    }, [editContext]);

    // Check for edit order on mount and when authentication changes
    useEffect(() => {
        checkForEditOrder();
    }, []);

    // Also check periodically for edit order (in case navigation sets it)
    useEffect(() => {
        const checkInterval = setInterval(() => {
            const orderDataString = sessionStorage.getItem('orderToEdit');
            if (orderDataString && !editContext) {
                checkForEditOrder();
            }
        }, 500);

        return () => clearInterval(checkInterval);
    }, [editContext, checkForEditOrder]);

    // Fetch cart when user is authenticated (but not in edit mode)
    useEffect(() => {
        if (isAuthenticated && !editContext) {
            const orderDataString = sessionStorage.getItem('orderToEdit');
            if (!orderDataString) {
                fetchCart();
            }
        } else if (!isAuthenticated) {
            setCart([]);
        }
    }, [isAuthenticated, editContext]);

    const fetchCart = async () => {
        try {
            setLoading(true);
            const items = await api.getCart();
            setCart(items.map(item => ({
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                unit: item.unit,
                description: item.description,
                quantityLimit: item.quantityLimit || 0
            })));
        } catch (err) {
            console.error('Failed to fetch cart', err);
        } finally {
            setLoading(false);
        }
    };

    const addToCart = useCallback(async (product, quantity) => {
        const existingIndex = cart.findIndex(item => item.productId === product._id);

        // Optimistically update local state
        let newCart = [...cart];
        if (existingIndex > -1) {
            newCart[existingIndex] = {
                ...newCart[existingIndex],
                quantity: newCart[existingIndex].quantity + quantity
            };
        } else {
            newCart.push({
                productId: product._id,
                productName: product.name,
                quantity,
                unit: product.unit,
                description: product.description,
                quantityLimit: product.quantityLimit || 0
            });
        }
        setCart(newCart);

        if (editContext) {
            return { ok: true };
        }

        // Normal mode: update server in background
        try {
            await api.addToCart(
                product._id,
                product.name,
                quantity,
                product.unit,
                product.description
            );
            // Silently refresh cart to ensure consistency
            fetchCart();
            return { ok: true };
        } catch (err) {
            // Revert state on error (optional, but good practice)
            // For now, we'll keep the optimistic update but maybe show an error if needed
            console.error('Failed to add to cart on server', err);
            // Re-fetch to sync with server state
            fetchCart();
            throw err;
        }
    }, [cart, editContext]);

    const updateCartItem = useCallback(async (productId, newQuantity) => {
        const item = cart.find(i => i.productId === productId);
        if (!item) return;

        // Optimistically update local state
        setCart(prev => prev.map(i =>
            i.productId === productId ? { ...i, quantity: newQuantity } : i
        ));

        if (editContext) {
            return { ok: true };
        }

        // Normal mode: update server in background
        try {
            await api.updateCartItem(productId, newQuantity);
            // Silently refresh cart to ensure consistency
            fetchCart();
            return { ok: true };
        } catch (err) {
            console.error('Failed to update cart item on server', err);
            // Re-fetch to sync with server state
            fetchCart();
            throw err;
        }
    }, [cart, editContext]);

    const removeFromCart = useCallback(async (productId) => {
        // Optimistically update local state
        setCart(prev => prev.filter(i => i.productId !== productId));

        if (editContext) {
            return { ok: true };
        }

        // Normal mode: update server in background
        try {
            await api.removeFromCart(productId);
            // Silently refresh cart to ensure consistency
            fetchCart();
            return { ok: true };
        } catch (err) {
            console.error('Failed to remove from cart on server', err);
            // Re-fetch to sync with server state
            fetchCart();
            throw err;
        }
    }, [editContext]);

    const clearCartState = useCallback(() => {
        setCart([]);
        setEditContext(null);
        sessionStorage.removeItem('orderToEdit');
    }, []);

    const placeOrder = useCallback(async () => {
        if (cart.length === 0 && editContext) {
            // Empty cart in edit mode = cancel order
            await api.cancelOrder(editContext.orderId);
            clearCartState();
            return { ok: true, message: 'Order removed successfully!' };
        }

        if (cart.length === 0) {
            throw new Error('Cart is empty');
        }

        if (editContext) {
            // Update existing order
            await api.editOrder(
                editContext.orderId,
                cart.map(item => ({ productId: item.productId, quantity: item.quantity }))
            );
            clearCartState();
            return { ok: true, message: 'Order updated successfully!' };
        } else {
            // Place new order
            const result = await api.placeOrder(cart);
            await api.clearCart();
            setCart([]);
            return result;
        }
    }, [cart, editContext, clearCartState]);

    const value = {
        cart,
        loading,
        editContext,
        addToCart,
        updateCartItem,
        removeFromCart,
        clearCartState,
        placeOrder,
        fetchCart,
    };

    return (
        <CartContext.Provider value={value}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
}
