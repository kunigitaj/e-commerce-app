// storefront-app/app/layout.js

'use client';
import { Providers } from './providers';
import { CartProvider } from '../contexts/cartContext';

import Navbar from '../components/Navbar';

export default function RootLayout({ children }) {
  return (
    <Providers>
      <CartProvider>
        <Navbar />
        {children}
      </CartProvider>
    </Providers>
  );
}
