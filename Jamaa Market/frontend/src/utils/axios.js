import axios from 'axios';

// Set up axios defaults
axios.defaults.withCredentials = true;
axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Add request interceptor for consistent error handling
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle session expiry globally
    if (error.response?.status === 401) {
      console.log('Session expired, clearing stored user data');
      localStorage.removeItem('afrozy-market-user');
      // Optionally redirect to login page
      // window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default axios;