const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateUser, createUser, authenticateToken } = require('../utils/auth');
const { pool } = require('../config/database');

const router = express.Router();

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Validation helper functions
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  // At least 6 characters
  return password && password.length >= 6;
};

// POST /api/auth/register - Register new customer
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, fullName, phone, address } = req.body;

    // Validation
    if (!username || !email || !password || !fullName) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, password, and full name are required'
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if user already exists in any table
    const existingUserChecks = await Promise.all([
      pool.query('SELECT id FROM customers WHERE email = $1 OR username = $2', [email, username]),
      pool.query('SELECT id FROM admins WHERE email = $1 OR username = $2', [email, username]),
      pool.query('SELECT id FROM store_owners WHERE email = $1 OR username = $2', [email, username])
    ]);

    const existingUser = existingUserChecks.some(result => result.rows.length > 0);

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email or username already exists'
      });
    }

    // Create new customer
    const userData = {
      username,
      email,
      full_name: fullName,
      phone: phone || null,
      address: address || null
    };

    const user = await createUser({ ...userData, password }, 'customer');

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        userType: 'customer' 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user,
        token
      }
    });

  } catch (error) {
    console.error('Registration error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error during registration'
    });
  }
});

// POST /api/auth/login - User login (any type)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Use the authenticateUser utility to handle multi-table authentication
    const authResult = await authenticateUser(email, password);

    if (!authResult.success) {
      return res.status(401).json({
        success: false,
        message: authResult.message
      });
    }

    res.json({
      success: true,
      message: authResult.message,
      data: authResult.data
    });

  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
});

// POST /api/auth/logout - User logout (client-side token removal)
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful. Please remove the token from client storage.'
  });
});

// GET /api/auth/profile - Get user profile (requires authentication)
router.get('/profile', authenticateToken(), async (req, res) => {
  try {
    // The authenticateToken middleware already fetches fresh user data
    res.json({
      success: true,
      data: {
        user: req.user
      }
    });

  } catch (error) {
    console.error('Profile fetch error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// PUT /api/auth/profile - Update user profile
router.put('/profile', authenticateToken(), async (req, res) => {
  try {
    const userId = req.user.userId;
    const userType = req.user.userType;
    const { fullName, phone, address } = req.body;

    if (!fullName) {
      return res.status(400).json({
        success: false,
        message: 'Full name is required'
      });
    }

    const tableMap = {
      'admin': 'admins',
      'customer': 'customers',
      'store_owner': 'store_owners'
    };

    const tableName = tableMap[userType];
    if (!tableName) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user type'
      });
    }

    const updateQuery = `
      UPDATE ${tableName} 
      SET full_name = $1, phone = $2, address = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [
      fullName,
      phone || null,
      address || null,
      userId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = result.rows[0];
    delete user.password_hash;
    user.user_type = userType;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user
      }
    });

  } catch (error) {
    console.error('Profile update error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// POST /api/auth/admin/login - Admin login
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Use the authenticateUser utility specifically for admins
    const authResult = await authenticateUser(email, password, 'admin');

    if (!authResult.success) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }

    // Generate JWT token with admin flag
    const token = jwt.sign(
      { 
        userId: authResult.data.user.id, 
        email: authResult.data.user.email, 
        userType: 'admin',
        isAdmin: true
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      message: 'Admin login successful',
      data: {
        user: authResult.data.user,
        token
      }
    });

  } catch (error) {
    console.error('Admin login error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error during admin login'
    });
  }
});

// POST /api/auth/store-owner/register - Store owner registration
router.post('/store-owner/register', async (req, res) => {
  try {
    const { username, email, password, fullName, phone, address, businessName, taxId, businessAddress } = req.body;

    // Validation
    if (!username || !email || !password || !fullName) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, password, and full name are required'
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if user already exists in any table
    const existingUserChecks = await Promise.all([
      pool.query('SELECT id FROM customers WHERE email = $1 OR username = $2', [email, username]),
      pool.query('SELECT id FROM admins WHERE email = $1 OR username = $2', [email, username]),
      pool.query('SELECT id FROM store_owners WHERE email = $1 OR username = $2', [email, username])
    ]);

    const existingUser = existingUserChecks.some(result => result.rows.length > 0);

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email or username already exists'
      });
    }

    // Create new store owner
    const userData = {
      username,
      email,
      full_name: fullName,
      phone: phone || null,
      address: address || null,
      business_name: businessName || null,
      tax_id: taxId || null,
      business_address: businessAddress || null
    };

    const user = await createUser({ ...userData, password }, 'store_owner');

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        userType: 'store_owner' 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      success: true,
      message: 'Store owner registered successfully',
      data: {
        user,
        token
      }
    });

  } catch (error) {
    console.error('Store owner registration error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error during registration'
    });
  }
});

// POST /api/auth/store-owner/login - Store owner login
router.post('/store-owner/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Use the authenticateUser utility specifically for store owners
    const authResult = await authenticateUser(email, password, 'store_owner');

    if (!authResult.success) {
      return res.status(401).json({
        success: false,
        message: 'Invalid store owner credentials'
      });
    }

    res.json({
      success: true,
      message: 'Store owner login successful',
      data: authResult.data
    });

  } catch (error) {
    console.error('Store owner login error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error during store owner login'
    });
  }
});

// Export middleware functions for use in other routes using the utils
router.authenticateToken = authenticateToken;
router.authenticateAdmin = authenticateToken('admin');

module.exports = router;