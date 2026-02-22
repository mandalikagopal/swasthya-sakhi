import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
};

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('swasthya_cart');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setCart(parsed);
      }
    } catch (e) {
      console.log('Failed to load cart', e);
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    try {
      if (cart.length === 0) {
        localStorage.removeItem('swasthya_cart');
      } else {
        localStorage.setItem('swasthya_cart', JSON.stringify(cart));
      }
    } catch (e) {
      console.log('Failed to save cart', e);
    }
  }, [cart]);

  const addtoCart = (med) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find(item => item.id === med.id);
      if (existingItem) {
        return prevCart.map(item =>
          item.id === med.id 
            ? { ...item, quantity: (item.quantity || 1) + 1 } 
            : item
        );
      }
      return [...prevCart, { ...med, quantity: 1 }];
    });
  };

  const updateQuantity = (id, delta) => {
    setCart(prev =>
      prev
        .map(it =>
          it.id === id
            ? { ...it, quantity: Math.max(1, (it.quantity || 1) + delta) }
            : it
        )
        .filter(it => (it.quantity || 1) > 0)
    );
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(it => it.id !== id));
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartTotalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

  return (
    <CartContext.Provider value={{
      cart,
      addtoCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      cartTotalItems
    }}>
      {children}
    </CartContext.Provider>
  );
};

export default CartProvider;