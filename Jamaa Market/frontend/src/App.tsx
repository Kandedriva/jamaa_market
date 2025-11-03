import React, { useState } from 'react';
import Products from './pages/Products';
import AdminPage from './pages/AdminPage';
import AdminLogin from './components/admin/AdminLogin';
import { CartProvider } from './context/CartContext';

function App() {
  const [currentRoute, setCurrentRoute] = useState(window.location.pathname);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  // Simple routing system
  React.useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleAdminLogin = (credentials: { username: string; password: string }) => {
    // In a real app, this would verify credentials with an API
    setIsAdminAuthenticated(true);
    window.history.pushState(null, '', '/admin');
    setCurrentRoute('/admin');
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    window.history.pushState(null, '', '/');
    setCurrentRoute('/');
  };

  // Add global click handler for admin links
  React.useEffect(() => {
    const handleLinkClick = (e: Event) => {
      const target = e.target as HTMLAnchorElement;
      if (target.tagName === 'A' && target.href) {
        const url = new URL(target.href);
        if (url.pathname.startsWith('/admin')) {
          e.preventDefault();
          if (!isAdminAuthenticated && url.pathname !== '/admin/login') {
            window.history.pushState(null, '', '/admin/login');
            setCurrentRoute('/admin/login');
          } else if (isAdminAuthenticated) {
            window.history.pushState(null, '', url.pathname);
            setCurrentRoute(url.pathname);
          }
        } else if (url.pathname === '/') {
          e.preventDefault();
          window.history.pushState(null, '', '/');
          setCurrentRoute('/');
        }
      }
    };

    document.addEventListener('click', handleLinkClick);
    return () => document.removeEventListener('click', handleLinkClick);
  }, [isAdminAuthenticated]);

  const renderPage = () => {
    if (currentRoute.startsWith('/admin')) {
      if (!isAdminAuthenticated) {
        return <AdminLogin onLogin={handleAdminLogin} />;
      }
      return <AdminPage onLogout={handleAdminLogout} />;
    }
    
    return (
      <CartProvider>
        <div>
          <Products />
          {/* Add admin link to the main page */}
          <div className="fixed bottom-4 right-4">
            <a
              href="/admin/login"
              className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition-colors shadow-lg"
            >
              Admin Login
            </a>
          </div>
        </div>
      </CartProvider>
    );
  };

  return renderPage();
}

export default App;
