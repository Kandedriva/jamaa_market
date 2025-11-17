const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Authenticate a user by email and password across all user types
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} userType - Expected user type ('admin', 'customer', 'store_owner') - optional
 * @returns {Object} - Authentication result with user data and token
 */
async function authenticateUser(email, password, userType = null) {
  try {
    let user = null;
    let tableName = '';
    let actualUserType = '';

    // If userType is specified, check only that table
    if (userType) {
      const tableMap = {
        'admin': 'admins',
        'customer': 'customers', 
        'store_owner': 'store_owners'
      };
      
      tableName = tableMap[userType];
      if (!tableName) {
        throw new Error('Invalid user type specified');
      }

      const result = await pool.query(
        `SELECT * FROM ${tableName} WHERE email = $1`,
        [email]
      );

      if (result.rows.length > 0) {
        user = result.rows[0];
        actualUserType = userType;
      }
    } else {
      // Check all tables to find the user
      const tables = [
        { name: 'admins', type: 'admin' },
        { name: 'customers', type: 'customer' },
        { name: 'store_owners', type: 'store_owner' }
      ];

      for (const table of tables) {
        const result = await pool.query(
          `SELECT * FROM ${table.name} WHERE email = $1`,
          [email]
        );

        if (result.rows.length > 0) {
          user = result.rows[0];
          tableName = table.name;
          actualUserType = table.type;
          break;
        }
      }
    }

    if (!user) {
      return {
        success: false,
        message: 'Invalid email or password'
      };
    }

    // Check if user account is active
    if (user.status !== 'active') {
      return {
        success: false,
        message: 'Account is not active. Please contact support.'
      };
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return {
        success: false,
        message: 'Invalid email or password'
      };
    }

    // Update last login timestamp
    await pool.query(
      `UPDATE ${tableName} SET last_login = CURRENT_TIMESTAMP WHERE id = $1`,
      [user.id]
    );

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        userType: actualUserType 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Remove password hash from response
    delete user.password_hash;
    user.user_type = actualUserType;

    return {
      success: true,
      message: 'Authentication successful',
      data: {
        user,
        token
      }
    };

  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      message: 'Authentication failed'
    };
  }
}

/**
 * Get user by ID and type
 * @param {number} userId - User ID
 * @param {string} userType - User type ('admin', 'customer', 'store_owner')
 * @returns {Object} - User data
 */
async function getUserById(userId, userType) {
  try {
    const tableMap = {
      'admin': 'admins',
      'customer': 'customers',
      'store_owner': 'store_owners'
    };

    const tableName = tableMap[userType];
    if (!tableName) {
      throw new Error('Invalid user type');
    }

    const result = await pool.query(
      `SELECT * FROM ${tableName} WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    delete user.password_hash;
    user.user_type = userType;

    return user;
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return null;
  }
}

/**
 * Create a new user
 * @param {Object} userData - User data
 * @param {string} userType - User type ('admin', 'customer', 'store_owner')
 * @returns {Object} - Created user data
 */
async function createUser(userData, userType) {
  try {
    const { password, ...userFields } = userData;
    
    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const tableMap = {
      'admin': 'admins',
      'customer': 'customers',
      'store_owner': 'store_owners'
    };

    const tableName = tableMap[userType];
    if (!tableName) {
      throw new Error('Invalid user type');
    }

    // Build insert query dynamically
    const fields = Object.keys(userFields);
    const values = Object.values(userFields);
    values.push(passwordHash);

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const fieldNames = [...fields, 'password_hash'].join(', ');

    const insertQuery = `
      INSERT INTO ${tableName} (${fieldNames})
      VALUES (${placeholders})
      RETURNING *
    `;

    const result = await pool.query(insertQuery, values);
    const user = result.rows[0];
    
    delete user.password_hash;
    user.user_type = userType;

    return user;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

/**
 * JWT middleware for authentication
 * @param {string} requiredUserType - Required user type (optional)
 * @returns {Function} - Express middleware function
 */
function authenticateToken(requiredUserType = null) {
  return async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      if (requiredUserType && decoded.userType !== requiredUserType) {
        return res.status(403).json({
          success: false,
          message: `${requiredUserType} access required`
        });
      }

      // Get fresh user data
      const user = await getUserById(decoded.userId, decoded.userType);
      if (!user) {
        return res.status(403).json({
          success: false,
          message: 'User not found'
        });
      }

      req.user = { ...decoded, ...user };
      next();
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
  };
}

module.exports = {
  authenticateUser,
  getUserById,
  createUser,
  authenticateToken
};