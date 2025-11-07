import React, { useState, useEffect } from 'react';
import Products from './pages/Products';
import AdminPage from './pages/AdminPage';
import AdminLogin from './components/admin/AdminLogin';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import { CartProvider, useCart } from './context/CartContext';

interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  user_type: 'customer' | 'admin';
}

// Inner component that uses cart context
function AppContent() {
  const [currentRoute, setCurrentRoute] = useState(window.location.pathname);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const { user, setUser } = useCart();

  // Check for existing authentication on app load
  useEffect(() => {
    const token = localStorage.getItem('jamaa-market-token');
    const userData = localStorage.getItem('jamaa-market-user');
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        
        // Set admin authentication if user is admin
        if (parsedUser.user_type === 'admin') {
          setIsAdminAuthenticated(true);
        }
      } catch (error) {
        // Invalid stored data, clear it
        localStorage.removeItem('jamaa-market-token');
        localStorage.removeItem('jamaa-market-user');
      }
    }
  }, [setUser]);

  // Simple routing system
  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLogin = (userData: User, token: string) => {
    setUser(userData);
    
    // Store token with correct key name
    localStorage.setItem('jamaa-market-token', token);
    
    // If admin user, set admin authentication
    if (userData.user_type === 'admin') {
      setIsAdminAuthenticated(true);
      window.history.pushState(null, '', '/admin');
      setCurrentRoute('/admin');
    } else {
      // Regular user goes to store
      window.history.pushState(null, '', '/');
      setCurrentRoute('/');
    }
  };

  const handleRegister = (userData: User, token: string) => {
    setUser(userData);
    
    // Store token with correct key name
    localStorage.setItem('jamaa-market-token', token);
    
    // New users go to store
    window.history.pushState(null, '', '/');
    setCurrentRoute('/');
  };

  const handleAdminLogin = (userData: User, token: string) => {
    setUser(userData);
    
    // Store token with correct key name
    localStorage.setItem('jamaa-market-token', token);
    
    // Set admin authentication
    setIsAdminAuthenticated(true);
    window.history.pushState(null, '', '/admin');
    setCurrentRoute('/admin');
  };

  const handleLogout = () => {
    // Clear authentication state
    setUser(null);
    setIsAdminAuthenticated(false);
    
    // Cart context will handle clearing localStorage and cart
    
    // Navigate to home
    window.history.pushState(null, '', '/');
    setCurrentRoute('/');
  };

  const navigateTo = (path: string) => {
    window.history.pushState(null, '', path);
    setCurrentRoute(path);
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
    // Authentication routes
    if (currentRoute === '/login') {
      return (
        <Login 
          onLoginSuccess={handleLogin}
          onNavigateToRegister={() => navigateTo('/register')}
          onNavigateToStore={() => navigateTo('/')}
        />
      );
    }

    if (currentRoute === '/register') {
      return (
        <Register 
          onRegisterSuccess={handleRegister}
          onNavigateToLogin={() => navigateTo('/login')}
          onNavigateToStore={() => navigateTo('/')}
        />
      );
    }

    // Admin routes
    if (currentRoute.startsWith('/admin')) {
      if (!isAdminAuthenticated) {
        return <AdminLogin onLogin={handleAdminLogin} />;
      }
      return <AdminPage onLogout={handleLogout} />;
    }
    
    // Main store
    return (
      <div>
        <Products user={user} onLogout={user ? handleLogout : undefined} />
        
        {/* Authentication links */}
        <div className="fixed bottom-4 right-4 space-y-2">
          {user ? (
            <div className="bg-white rounded-lg shadow-lg p-3 border">
              <p className="text-sm text-gray-600">Welcome, {user.full_name}!</p>
              <div className="mt-2 space-x-2">
                {user.user_type === 'admin' && (
                  <button
                    onClick={() => navigateTo('/admin')}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                  >
                    Admin Panel
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700 transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => navigateTo('/login')}
                className="block w-full bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors shadow-lg"
              >
                Login
              </button>
              <button
                onClick={() => navigateTo('/register')}
                className="block w-full bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 transition-colors shadow-lg"
              >
                Sign Up
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return renderPage();
}

// Main App component with CartProvider
function App() {
  return (
    <CartProvider>
      <AppContent />
    </CartProvider>
  );
}

export default App;
