// storefront-app/contexts/cartContext.js

'use client';
import { createContext, useContext, useState } from 'react';

const CartContext = createContext({
  cartItems: [],
  addToCart: () => { },
  removeFromCart: () => { },
  updateQuantity: () => { },
  calculateTotal: () => 0,
  clearCart: () => { },
  fetchProductDetails: () => Promise.resolve({}),
});

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);

  const addToCart = product => {
    console.log(`Adding product to cart: ${product.name}`);
    setCartItems(currentItems => {
      const existingItem = currentItems.find(item => item.id === product.id);
      if (existingItem) {
        console.log(`Product already in cart, increasing quantity: ${product.name}`);
        return currentItems.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      console.log(`Product not in cart, adding new item: ${product.name}`);
      return [...currentItems, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = productId => {
    console.log(`Removing product from cart: ID ${productId}`);
    setCartItems(currentItems =>
      currentItems.filter(item => item.id !== productId)
    );
  };

  const updateQuantity = (productId, quantity) => {
    console.log(`Updating quantity for product: ID ${productId}, New Quantity: ${quantity}`);
    setCartItems(currentItems =>
      currentItems.map(item =>
        item.id === productId ? { ...item, quantity: Math.max(1, quantity) } : item
      )
    );
  };

  const calculateTotal = () => {
    const total = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
    console.log(`Calculating total cost of cart: $${total.toFixed(2)}`);
    return total;
  };

  const clearCart = () => {
    console.log(`Clearing cart`);
    setCartItems([]);
  };

  const fetchProductDetails = async (productId) => {
    try {
      console.log(`Fetching product details for ID ${productId}`);
      const response = await fetch(`/api/product/${productId}`, { cache: 'no-store' });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
      }
      const data = await response.json();
      console.log(`Fetched product details for ID ${productId}:`, data);
      return data;
    } catch (error) {
      console.error(`Failed to fetch product details for ID ${productId}:`, error);
      return null;
    }
  };

  return (
    <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, updateQuantity, calculateTotal, clearCart, fetchProductDetails }}>
      {children}
    </CartContext.Provider>
  );
};
