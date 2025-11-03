import React from 'react';
import Products from './pages/Products';
import { CartProvider } from './context/CartContext';

function App() {
  return (
    <CartProvider>
      <Products />
    </CartProvider>
  );
}

export default App;
