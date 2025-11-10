const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const router = express.Router();

// GET /api/store/all - Get all stores for public listing
router.get('/all', async (req, res) => {
  try {
    const storesQuery = `
      SELECT 
        s.id,
        s.store_name,
        s.store_description,
        s.store_address,
        s.business_type,
        s.categories,
        s.status,
        s.created_at,
        u.full_name as owner_name,
        u.email as owner_email
      FROM stores s
      JOIN users u ON s.owner_id = u.id
      ORDER BY s.created_at DESC
    `;

    const result = await pool.query(storesQuery);
    
    // Parse categories for each store
    const stores = result.rows.map(store => ({
      ...store,
      categories: store.categories ? 
        (typeof store.categories === 'string' ? JSON.parse(store.categories) : store.categories) 
        : []
    }));

    res.json({
      success: true,
      data: stores
    });

  } catch (error) {
    console.error('Error fetching stores:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stores'
    });
  }
});


// JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Validation helper functions
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  return password && password.length >= 6;
};

// POST /api/store/register - Register new store owner
router.post('/register', async (req, res) => {
  try {
    const { 
      fullName, email, phone, password, 
      storeName, storeDescription, storeAddress, 
      businessType, businessLicense, categories 
    } = req.body;

    // Validation
    if (!fullName || !email || !password || !storeName || !storeDescription || !storeAddress || !businessType) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be filled'
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

    if (!categories || categories.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please select at least one store category'
      });
    }

    // Check if user already exists
    const existingUserQuery = 'SELECT id FROM users WHERE email = $1';
    const existingUser = await pool.query(existingUserQuery, [email]);

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generate unique username for store owner
    const username = email.split('@')[0] + '_store_' + Date.now();

    // Begin transaction
    await pool.query('BEGIN');

    try {
      // Insert new store owner user
      const insertUserQuery = `
        INSERT INTO users (username, email, password_hash, full_name, phone, user_type)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, username, email, full_name, phone, user_type, status, created_at
      `;

      const userResult = await pool.query(insertUserQuery, [
        username,
        email,
        passwordHash,
        fullName,
        phone || null,
        'store_owner'
      ]);

      const user = userResult.rows[0];

      // Insert store information
      const insertStoreQuery = `
        INSERT INTO stores (
          owner_id, store_name, store_description, store_address, 
          business_type, business_license, categories, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, store_name, store_description, store_address, 
                  business_type, business_license, categories, status, created_at
      `;

      const storeResult = await pool.query(insertStoreQuery, [
        user.id,
        storeName,
        storeDescription,
        storeAddress,
        businessType,
        businessLicense || null,
        JSON.stringify(categories),
        'pending' // Store needs approval
      ]);

      const store = storeResult.rows[0];

      // Commit transaction
      await pool.query('COMMIT');

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

      // Combine user and store data
      const responseData = {
        ...user,
        store: {
          ...store,
          categories: typeof store.categories === 'string' 
            ? JSON.parse(store.categories) 
            : store.categories
        }
      };

      res.status(201).json({
        success: true,
        message: 'Store owner registered successfully. Your store is pending approval.',
        data: {
          user: responseData,
          token
        }
      });

    } catch (error) {
      // Rollback transaction on error
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Store registration error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error during store registration'
    });
  }
});

// POST /api/store/login - Store owner login
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

    // Find store owner by email
    const userQuery = `
      SELECT u.id, u.username, u.email, u.password_hash, u.full_name, 
             u.phone, u.user_type, u.status, u.created_at,
             s.id as store_id, s.store_name, s.store_description, 
             s.store_address, s.business_type, s.business_license, 
             s.categories, s.status as store_status, s.created_at as store_created_at
      FROM users u
      LEFT JOIN stores s ON u.id = s.owner_id
      WHERE u.email = $1 AND u.user_type = 'store_owner'
    `;
    
    const result = await pool.query(userQuery, [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid store owner credentials'
      });
    }

    const userData = result.rows[0];

    // Check if user account is active
    if (userData.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your store owner account is not active. Please contact support.'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, userData.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid store owner credentials'
      });
    }

    // Update last login timestamp
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [userData.id]
    );

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: userData.id, 
        email: userData.email, 
        userType: userData.user_type 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Structure response data
    const user = {
      id: userData.id,
      username: userData.username,
      email: userData.email,
      full_name: userData.full_name,
      phone: userData.phone,
      user_type: userData.user_type,
      status: userData.status,
      created_at: userData.created_at,
      store: userData.store_id ? {
        id: userData.store_id,
        store_name: userData.store_name,
        store_description: userData.store_description,
        store_address: userData.store_address,
        business_type: userData.business_type,
        business_license: userData.business_license,
        categories: userData.categories ? 
          (typeof userData.categories === 'string' ? JSON.parse(userData.categories) : userData.categories) 
          : [],
        status: userData.store_status,
        created_at: userData.store_created_at
      } : null
    };

    res.json({
      success: true,
      message: 'Store owner login successful',
      data: {
        user,
        token
      }
    });

  } catch (error) {
    console.error('Store owner login error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
});

// GET /api/store/products - Get store owner's products
router.get('/products', authenticateStoreOwner, async (req, res) => {
  try {
    const storeId = req.user.storeId;

    const productsQuery = `
      SELECT p.*, s.store_name
      FROM products p
      JOIN stores s ON p.store_id = s.id
      WHERE p.store_id = $1
      ORDER BY p.created_at DESC
    `;

    const result = await pool.query(productsQuery, [storeId]);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Error fetching store products:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products'
    });
  }
});

// POST /api/store/products - Add new product
router.post('/products', authenticateStoreOwner, async (req, res) => {
  try {
    const storeId = req.user.storeId;
    const { name, description, price, category, image_url, stock_quantity } = req.body;

    if (!name || !description || !price || !category || !image_url || stock_quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: 'All product fields are required'
      });
    }

    const insertProductQuery = `
      INSERT INTO products (store_id, name, description, price, category, image_url, stock_quantity)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await pool.query(insertProductQuery, [
      storeId, name, description, price, category, image_url, stock_quantity
    ]);

    res.status(201).json({
      success: true,
      message: 'Product added successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error adding product:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to add product'
    });
  }
});

// PUT /api/store/products/:id - Update product
router.put('/products/:id', authenticateStoreOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const storeId = req.user.storeId;
    const { name, description, price, category, image_url, stock_quantity } = req.body;

    const updateProductQuery = `
      UPDATE products 
      SET name = $1, description = $2, price = $3, category = $4, 
          image_url = $5, stock_quantity = $6, updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND store_id = $8
      RETURNING *
    `;

    const result = await pool.query(updateProductQuery, [
      name, description, price, category, image_url, stock_quantity, id, storeId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or not authorized'
      });
    }

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating product:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to update product'
    });
  }
});

// DELETE /api/store/products/:id - Delete product
router.delete('/products/:id', authenticateStoreOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const storeId = req.user.storeId;

    const deleteProductQuery = `
      DELETE FROM products 
      WHERE id = $1 AND store_id = $2
      RETURNING id, name
    `;

    const result = await pool.query(deleteProductQuery, [id, storeId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or not authorized'
      });
    }

    res.json({
      success: true,
      message: 'Product deleted successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error deleting product:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to delete product'
    });
  }
});

// GET /api/store/sales - Get store sales
router.get('/sales', authenticateStoreOwner, async (req, res) => {
  try {
    const storeId = req.user.storeId;

    const salesQuery = `
      SELECT 
        oi.id,
        p.name as product_name,
        oi.quantity,
        oi.price_per_item,
        (oi.quantity * oi.price_per_item) as total_price,
        u.full_name as customer_name,
        o.created_at as sale_date,
        o.status
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      JOIN users u ON o.user_id = u.id
      WHERE p.store_id = $1
      ORDER BY o.created_at DESC
    `;

    const result = await pool.query(salesQuery, [storeId]);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Error fetching store sales:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales data'
    });
  }
});

// Middleware to authenticate store owners
function authenticateStoreOwner(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Store owner access token required'
    });
  }

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    // Check if user is store owner
    if (user.userType !== 'store_owner') {
      return res.status(403).json({
        success: false,
        message: 'Store owner access required'
      });
    }

    // Get store ID for this store owner
    try {
      const storeQuery = 'SELECT id FROM stores WHERE owner_id = $1';
      const result = await pool.query(storeQuery, [user.userId]);
      
      if (result.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'No store found for this user'
        });
      }

      req.user = { ...user, storeId: result.rows[0].id };
      next();
    } catch (error) {
      console.error('Error verifying store owner:', error);
      return res.status(500).json({
        success: false,
        message: 'Authentication error'
      });
    }
  });
}

module.exports = router;