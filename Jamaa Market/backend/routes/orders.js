const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Driver assignment logic
async function assignOrderToDriver(client, orderId) {
  try {
    // Find an available online driver
    const availableDriverQuery = `
      SELECT id FROM drivers 
      WHERE status = 'online' AND is_verified = true
      ORDER BY (total_deliveries / COALESCE(NULLIF(rating, 0), 1)) ASC, total_deliveries ASC
      LIMIT 1
    `;
    
    const driverResult = await client.query(availableDriverQuery);
    
    if (driverResult.rows.length > 0) {
      const driverId = driverResult.rows[0].id;
      
      // Assign driver to order and update status
      await client.query(
        `UPDATE orders 
         SET driver_id = $1, status = 'assigned', assigned_at = CURRENT_TIMESTAMP,
             estimated_delivery = CURRENT_TIMESTAMP + INTERVAL '2 hours'
         WHERE id = $2`,
        [driverId, orderId]
      );
      
      // Update driver status to busy
      await client.query(
        'UPDATE drivers SET status = $1 WHERE id = $2',
        ['busy', driverId]
      );
      
      // Create delivery tracking entry
      await client.query(
        `INSERT INTO delivery_tracking (order_id, driver_id, status, timestamp)
         VALUES ($1, $2, 'assigned', CURRENT_TIMESTAMP)`,
        [orderId, driverId]
      );
      
      console.log(`Order ${orderId} assigned to driver ${driverId}`);
      return driverId;
    } else {
      console.log(`No available drivers for order ${orderId}`);
      return null;
    }
  } catch (error) {
    console.error('Error assigning order to driver:', error);
    return null;
  }
}

// GET user orders
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, page = 1, limit = 10 } = req.query;

    let query = `
      SELECT o.id, o.order_number, o.status, o.total, o.shipping_address, 
             o.payment_method, o.created_at, o.estimated_delivery, o.tracking_number,
             COUNT(oi.id) as item_count
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.user_id = $1
    `;
    const queryParams = [userId];

    // Add status filter
    if (status) {
      query += ` AND o.status = $${queryParams.length + 1}`;
      queryParams.push(status);
    }

    query += ` GROUP BY o.id ORDER BY o.created_at DESC`;

    // Add pagination
    const offset = (page - 1) * limit;
    query += ` LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM orders WHERE user_id = $1';
    const countParams = [userId];
    
    if (status) {
      countQuery += ` AND status = $${countParams.length + 1}`;
      countParams.push(status);
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        orders: result.rows.map(order => ({
          id: order.id,
          orderNumber: order.order_number,
          status: order.status,
          total: parseFloat(order.total),
          shippingAddress: order.shipping_address,
          paymentMethod: order.payment_method,
          orderDate: order.created_at,
          estimatedDelivery: order.estimated_delivery,
          trackingNumber: order.tracking_number,
          itemCount: parseInt(order.item_count)
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching orders:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders'
    });
  }
});

// GET specific order details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const orderId = req.params.id;

    // Get order details
    const orderQuery = `
      SELECT id, order_number, status, total, shipping_address, payment_method, 
             created_at, estimated_delivery, tracking_number
      FROM orders 
      WHERE id = $1 AND user_id = $2
    `;
    
    const orderResult = await pool.query(orderQuery, [orderId, userId]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const order = orderResult.rows[0];

    // Get order items
    const itemsQuery = `
      SELECT oi.id, oi.quantity, oi.price, p.name, p.image_url
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = $1
    `;

    const itemsResult = await pool.query(itemsQuery, [orderId]);

    res.json({
      success: true,
      data: {
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        total: parseFloat(order.total),
        shippingAddress: order.shipping_address,
        paymentMethod: order.payment_method,
        orderDate: order.created_at,
        estimatedDelivery: order.estimated_delivery,
        trackingNumber: order.tracking_number,
        items: itemsResult.rows.map(item => ({
          id: item.id,
          productName: item.name,
          quantity: item.quantity,
          price: parseFloat(item.price),
          imageUrl: item.image_url
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching order details:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order details'
    });
  }
});

// Middleware to authenticate users (optional for guest checkout)
function authenticateUser(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';

  if (!token) {
    req.user = null;
    return next();
  }

  const jwt = require('jsonwebtoken');
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      req.user = null;
    } else {
      req.user = user;
    }
    next();
  });
}

// POST create new order (updated for store-based cart)
router.post('/', authenticateUser, async (req, res) => {
  try {
    const { items, customer_info, total_amount } = req.body;

    // Validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order items are required'
      });
    }

    if (!customer_info || !customer_info.fullName || !customer_info.email || !customer_info.phone || !customer_info.address) {
      return res.status(400).json({
        success: false,
        message: 'Customer information is required (name, email, phone, address)'
      });
    }

    if (!total_amount || total_amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid total amount is required'
      });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Generate order number
      const orderNumber = 'JM' + Date.now().toString().slice(-8);

      // Insert order with customer information
      const orderQuery = `
        INSERT INTO orders (
          user_id, order_number, status, total, 
          customer_name, customer_email, customer_phone, 
          shipping_address, order_notes, created_at
        )
        VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
        RETURNING id, order_number, created_at
      `;

      const orderResult = await client.query(orderQuery, [
        req.user ? req.user.userId : null,
        orderNumber,
        total_amount,
        customer_info.fullName,
        customer_info.email,
        customer_info.phone,
        customer_info.address,
        customer_info.notes || null
      ]);

      const order = orderResult.rows[0];

      // Insert order items
      const orderItemQuery = `
        INSERT INTO order_items (order_id, product_id, quantity, price, price_per_item)
        VALUES ($1, $2, $3, $4, $5)
      `;

      for (const item of items) {
        const totalPrice = item.price_per_item * item.quantity;
        await client.query(orderItemQuery, [
          order.id,
          item.product_id,
          item.quantity,
          totalPrice,
          item.price_per_item
        ]);

        // Update product stock
        await client.query(
          'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
          [item.quantity, item.product_id]
        );
      }

      // Auto-assign to available driver if user is authenticated
      if (req.user) {
        await assignOrderToDriver(client, order.id);
        
        // Clear user's cart if authenticated
        await client.query('DELETE FROM cart_items WHERE user_id = $1', [req.user.userId]);
      }

      await client.query('COMMIT');

      // Create notification only for authenticated users
      if (req.user) {
        await client.query(
          `INSERT INTO notifications (user_id, title, message, type, action_link, is_read, created_at)
           VALUES ($1, $2, $3, $4, $5, false, CURRENT_TIMESTAMP)`,
          [
            req.user.userId,
            'Order Confirmed',
            `Your order ${orderNumber} has been confirmed and is being processed.`,
            'order',
            `/account/orders/${order.id}`
          ]
        );
      }

      res.status(201).json({
        success: true,
        message: 'Order placed successfully',
        data: {
          order_id: order.id,
          order_number: orderNumber,
          total_amount,
          created_at: order.created_at,
          status: 'pending'
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error creating order:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create order'
    });
  }
});

// PUT cancel order
router.put('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const orderId = req.params.id;

    const result = await pool.query(
      `UPDATE orders 
       SET status = 'cancelled' 
       WHERE id = $1 AND user_id = $2 AND status IN ('pending', 'confirmed')
       RETURNING id, order_number`,
      [orderId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or cannot be cancelled'
      });
    }

    const order = result.rows[0];

    // Create notification
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, action_link, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, false, CURRENT_TIMESTAMP)`,
      [
        userId,
        'Order Cancelled',
        `Your order ${order.order_number} has been cancelled successfully.`,
        'order',
        `/account/orders/${order.id}`
      ]
    );

    res.json({
      success: true,
      message: 'Order cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling order:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel order'
    });
  }
});

module.exports = router;