const express = require('express');
const { pool } = require('../config/database');
const router = express.Router();

// Middleware for admin authentication (simplified for demo)
const authenticateAdmin = (req, res, next) => {
  // In a real application, you would verify JWT token here
  // For demo purposes, we'll just pass through
  next();
};

// GET all products for admin
router.get('/products', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, description, price, category, image_url, stock_quantity, 
             created_at, updated_at 
      FROM products 
      ORDER BY created_at DESC
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching products for admin:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products'
    });
  }
});

// POST create new product
router.post('/products', authenticateAdmin, async (req, res) => {
  try {
    const { name, description, price, category, image_url, stock_quantity } = req.body;
    
    // Validate required fields
    if (!name || !description || !price || !category || !image_url || stock_quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    const result = await pool.query(`
      INSERT INTO products (name, description, price, category, image_url, stock_quantity)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [name, description, price, category, image_url, stock_quantity]);

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Product created successfully'
    });
  } catch (error) {
    console.error('Error creating product:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to create product'
    });
  }
});

// PUT update product
router.put('/products/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, category, image_url, stock_quantity } = req.body;

    // Validate required fields
    if (!name || !description || !price || !category || !image_url || stock_quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    const result = await pool.query(`
      UPDATE products 
      SET name = $1, description = $2, price = $3, category = $4, 
          image_url = $5, stock_quantity = $6, updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `, [name, description, price, category, image_url, stock_quantity, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Product updated successfully'
    });
  } catch (error) {
    console.error('Error updating product:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to update product'
    });
  }
});

// DELETE product
router.delete('/products/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting product:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to delete product'
    });
  }
});

// GET dashboard statistics
router.get('/dashboard/stats', authenticateAdmin, async (req, res) => {
  try {
    // Get product count
    const productCount = await pool.query('SELECT COUNT(*) as count FROM products');
    
    // Get total revenue (mock data for now)
    const revenueQuery = await pool.query(`
      SELECT SUM(price * stock_quantity) as total_value 
      FROM products
    `);

    // Mock data for orders and users (would come from actual tables in real app)
    const stats = {
      totalProducts: parseInt(productCount.rows[0].count),
      totalOrders: 127, // Mock data
      totalRevenue: parseFloat(revenueQuery.rows[0].total_value) || 0,
      totalUsers: 342, // Mock data
      lowStockProducts: await pool.query(`
        SELECT name, stock_quantity 
        FROM products 
        WHERE stock_quantity < 10 
        ORDER BY stock_quantity ASC
        LIMIT 5
      `),
      topCategories: await pool.query(`
        SELECT category, COUNT(*) as product_count
        FROM products 
        GROUP BY category 
        ORDER BY product_count DESC
        LIMIT 5
      `)
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics'
    });
  }
});

// GET low stock alerts
router.get('/alerts/low-stock', authenticateAdmin, async (req, res) => {
  try {
    const threshold = req.query.threshold || 10;
    
    const result = await pool.query(`
      SELECT id, name, stock_quantity, category
      FROM products 
      WHERE stock_quantity < $1
      ORDER BY stock_quantity ASC
    `, [threshold]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching low stock alerts:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch low stock alerts'
    });
  }
});

// POST bulk update stock
router.post('/products/bulk-update-stock', authenticateAdmin, async (req, res) => {
  try {
    const { updates } = req.body; // Array of { id, stock_quantity }
    
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Updates array is required'
      });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const update of updates) {
        await client.query(`
          UPDATE products 
          SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [update.stock_quantity, update.id]);
      }
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: `Successfully updated ${updates.length} products`
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error bulk updating stock:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to update product stock'
    });
  }
});

// GET category analytics
router.get('/analytics/categories', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        category,
        COUNT(*) as product_count,
        AVG(price) as avg_price,
        SUM(stock_quantity) as total_stock,
        MIN(price) as min_price,
        MAX(price) as max_price
      FROM products 
      GROUP BY category 
      ORDER BY product_count DESC
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching category analytics:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category analytics'
    });
  }
});

module.exports = router;