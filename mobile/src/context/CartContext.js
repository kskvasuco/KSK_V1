import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import * as userApi from '../api/userApi';

const ORDER_EDIT_KEY = 'orderToEdit';
const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { isUser } = useAuth();
  const [cart, setCart] = useState([]);
  const [editContext, setEditContext] = useState(null);
  const [loading, setLoading] = useState(false);

  const checkForEditOrder = useCallback(async () => {
    const raw = await AsyncStorage.getItem(ORDER_EDIT_KEY);
    if (!raw || editContext) return false;
    try {
      const orderData = JSON.parse(raw);
      if (orderData.orderId && orderData.items) {
        setEditContext({ orderId: orderData.orderId });
        setCart(
          orderData.items.map((item) => ({
            ...item,
            quantity: parseFloat(item.quantity),
          }))
        );
        return true;
      }
    } catch {
      await AsyncStorage.removeItem(ORDER_EDIT_KEY);
    }
    return false;
  }, [editContext]);

  useEffect(() => {
    checkForEditOrder();
  }, []);

  useEffect(() => {
    if (isUser && !editContext) {
      AsyncStorage.getItem(ORDER_EDIT_KEY).then((raw) => {
        if (!raw) fetchCart();
      });
    } else if (!isUser) {
      setCart([]);
    }
  }, [isUser, editContext]);

  const fetchCart = async () => {
    try {
      setLoading(true);
      const items = await userApi.getCart();
      setCart(
        items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unit: item.unit,
          description: item.description,
          quantityLimit: item.quantityLimit || 0,
        }))
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = useCallback(
    async (product, quantity) => {
      const existingIndex = cart.findIndex((i) => i.productId === product._id);
      let newCart = [...cart];
      if (existingIndex > -1) {
        newCart[existingIndex] = {
          ...newCart[existingIndex],
          quantity: newCart[existingIndex].quantity + quantity,
        };
      } else {
        newCart.push({
          productId: product._id,
          productName: product.name,
          quantity,
          unit: product.unit,
          description: product.description,
          quantityLimit: product.quantityLimit || 0,
        });
      }
      setCart(newCart);
      if (editContext) return { ok: true };
      await userApi.addToCart(product._id, product.name, quantity, product.unit, product.description);
      fetchCart();
      return { ok: true };
    },
    [cart, editContext]
  );

  const updateCartItem = useCallback(
    async (productId, newQuantity) => {
      setCart((prev) => prev.map((i) => (i.productId === productId ? { ...i, quantity: newQuantity } : i)));
      if (editContext) return { ok: true };
      await userApi.updateCartItem(productId, newQuantity);
      fetchCart();
      return { ok: true };
    },
    [editContext]
  );

  const removeFromCart = useCallback(
    async (productId) => {
      setCart((prev) => prev.filter((i) => i.productId !== productId));
      if (editContext) return { ok: true };
      await userApi.removeFromCart(productId);
      fetchCart();
      return { ok: true };
    },
    [editContext]
  );

  const clearCartState = useCallback(async () => {
    setCart([]);
    setEditContext(null);
    await AsyncStorage.removeItem(ORDER_EDIT_KEY);
  }, []);

  const startEditOrder = useCallback(async (orderId, items) => {
    const payload = { orderId, items };
    await AsyncStorage.setItem(ORDER_EDIT_KEY, JSON.stringify(payload));
    setEditContext({ orderId });
    setCart(items.map((i) => ({ ...i, quantity: parseFloat(i.quantity) })));
  }, []);

  const placeOrder = useCallback(async () => {
    if (cart.length === 0 && editContext) {
      await userApi.cancelOrder(editContext.orderId);
      await clearCartState();
      return { ok: true, message: 'Order removed successfully!' };
    }
    if (cart.length === 0) throw new Error('Cart is empty');
    if (editContext) {
      await userApi.editOrder(
        editContext.orderId,
        cart.map((i) => ({ productId: i.productId, quantity: i.quantity }))
      );
      await clearCartState();
      return { ok: true, message: 'Order updated successfully!' };
    }
    const result = await userApi.placeOrder(cart);
    await userApi.clearCart();
    setCart([]);
    return result;
  }, [cart, editContext, clearCartState]);

  return (
    <CartContext.Provider
      value={{
        cart,
        loading,
        editContext,
        addToCart,
        updateCartItem,
        removeFromCart,
        clearCartState,
        placeOrder,
        fetchCart,
        startEditOrder,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
