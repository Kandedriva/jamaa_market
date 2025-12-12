import axios from 'axios';

// Set up axios defaults
axios.defaults.withCredentials = true;
axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'https://localhost:3001/api';

// Add request interceptor to include JWT token for store owners
axios.interceptors.request.use(
  (config) => {
    // Check if we have a JWT token stored (for store owners)
    const token = localStorage.getItem('afrozy-market-token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for consistent error handling
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle auth expiry globally
    if (error.response?.status === 401) {
      console.log('Authentication expired, clearing stored data');
      localStorage.removeItem('afrozy-market-user');
      localStorage.removeItem('afrozy-market-token');
      // Optionally redirect to login page
      // window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default axios;