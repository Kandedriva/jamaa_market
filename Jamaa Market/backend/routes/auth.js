const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const router = express.Router();

// JWT secret from environment variables
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

// POST /api/auth/register - Register new user
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

    // Check if user already exists
    const existingUserQuery = 'SELECT id FROM users WHERE email = $1 OR username = $2';
    const existingUser = await pool.query(existingUserQuery, [email, username]);

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'User with this email or username already exists'
      });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert new user
    const insertUserQuery = `
      INSERT INTO users (username, email, password_hash, full_name, phone, address)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, username, email, full_name, phone, address, user_type, status, created_at
    `;

    const result = await pool.query(insertUserQuery, [
      username,
      email,
      passwordHash,
      fullName,
      phone || null,
      address || null
    ]);

    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        userType: user.user_type 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Remove sensitive data before sending response
    delete user.password_hash;

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

// POST /api/auth/login - User login
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

    // Find user by email
    const userQuery = `
      SELECT id, username, email, password_hash, full_name, phone, address, 
             user_type, status, email_verified, created_at
      FROM users 
      WHERE email = $1
    `;
    
    const result = await pool.query(userQuery, [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = result.rows[0];

    // Check if user account is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your account is not active. Please contact support.'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login timestamp
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        userType: user.user_type 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Remove sensitive data before sending response
    delete user.password_hash;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        token
      }
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
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const userQuery = `
      SELECT id, username, email, full_name, phone, address, 
             user_type, status, email_verified, created_at, last_login
      FROM users 
      WHERE id = $1
    `;
    
    const result = await pool.query(userQuery, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: result.rows[0]
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
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { fullName, phone, address } = req.body;

    if (!fullName) {
      return res.status(400).json({
        success: false,
        message: 'Full name is required'
      });
    }

    const updateQuery = `
      UPDATE users 
      SET full_name = $1, phone = $2, address = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING id, username, email, full_name, phone, address, user_type, status, updated_at
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

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: result.rows[0]
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

    // Find user by email and check if admin
    const userQuery = `
      SELECT id, username, email, password_hash, full_name, phone, address, 
             user_type, status, email_verified, created_at
      FROM users 
      WHERE email = $1 AND user_type = 'admin'
    `;
    
    const result = await pool.query(userQuery, [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }

    const user = result.rows[0];

    // Check if admin account is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Admin account is not active. Please contact support.'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }

    // Update last login timestamp
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Generate JWT token with admin flag
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        userType: user.user_type,
        isAdmin: true
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Remove sensitive data before sending response
    delete user.password_hash;

    res.json({
      success: true,
      message: 'Admin login successful',
      data: {
        user,
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

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    req.user = user;
    next();
  });
}

// Middleware to authenticate admin users only
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Admin access token required'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    // Check if user is admin
    if (user.userType !== 'admin' || !user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    req.user = user;
    next();
  });
}

// Export middleware functions for use in other routes
router.authenticateToken = authenticateToken;
router.authenticateAdmin = authenticateAdmin;

module.exports = router;