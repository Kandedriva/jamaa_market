const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { pool } = require('../config/database');
const { authenticateSession } = require('./auth');

// Middleware to extract user ID or session ID
const extractUserOrSession = (req, res, next) => {
  if (req.session && req.session.userId) {
    // User is authenticated via session
    req.isAuthenticated = true;
    req.userId = req.session.userId;
    next();
  } else {
    // Guest user - get session ID from headers
    const sessionId = req.headers['x-session-id'];
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID required for guest checkout'
      });
    }
    
    req.sessionId = sessionId;
    req.isAuthenticated = false;
    next();
  }
};

// Create a payment intent for checkout
router.post('/create-payment-intent', extractUserOrSession, async (req, res) => {
  try {
    const { amount, currency = 'usd', metadata = {} } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      metadata: {
        userId: req.session?.userId || 'guest',
        sessionId: req.sessionId || '',
        ...metadata
      },
      payment_method_types: ['card'], // Only allow card payments
    });

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      }
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment intent',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Process checkout with cart items
router.post('/process', extractUserOrSession, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get cart items
    let cartQuery, cartParams;
    if (req.isAuthenticated && req.userId) {
      cartQuery = `
        SELECT ci.*, p.name, p.price, p.stock_quantity, p.image_url, p.store_id
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.user_id = $1
      `;
      cartParams = [req.userId];
    } else {
      cartQuery = `
        SELECT ci.*, p.name, p.price, p.stock_quantity, p.image_url, p.store_id
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.session_id = $1
      `;
      cartParams = [req.sessionId];
    }

    const cartResult = await client.query(cartQuery, cartParams);
    const cartItems = cartResult.rows;

    if (cartItems.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }

    // Check stock availability
    for (const item of cartItems) {
      if (item.quantity > item.stock_quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${item.name}. Available: ${item.stock_quantity}, Requested: ${item.quantity}`
        });
      }
    }

    // Calculate total amount
    const totalAmount = cartItems.reduce((total, item) => {
      return total + (parseFloat(item.price) * item.quantity);
    }, 0);

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalAmount * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        userId: req.userId || 'guest',
        sessionId: req.sessionId || '',
        orderType: 'cart_checkout'
      },
      payment_method_types: ['card'], // Only allow card payments
    });

    // Create order record
    const orderInsertQuery = `
      INSERT INTO orders (
        user_id, session_id, total, total_amount, status, 
        payment_intent_id, items, payment_method, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id, created_at
    `;

    const orderResult = await client.query(orderInsertQuery, [
      req.userId || null,
      req.sessionId || null,
      totalAmount,  // For 'total' column
      totalAmount,  // For 'total_amount' column  
      'pending',
      paymentIntent.id,
      JSON.stringify(cartItems),
      'stripe'  // payment_method
    ]);

    const orderId = orderResult.rows[0].id;

    // Update stock quantities
    for (const item of cartItems) {
      await client.query(
        'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        orderId,
        totalAmount,
        items: cartItems
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing checkout:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    res.status(500).json({
      success: false,
      message: 'Failed to process checkout',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    client.release();
  }
});

// Confirm payment and complete order
router.post('/confirm', extractUserOrSession, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment intent ID is required'
      });
    }

    await client.query('BEGIN');

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      // Update order status
      const updateOrderQuery = `
        UPDATE orders 
        SET status = 'completed', updated_at = NOW()
        WHERE payment_intent_id = $1
        RETURNING id, user_id, session_id
      `;
      
      const orderResult = await client.query(updateOrderQuery, [paymentIntentId]);
      
      if (orderResult.rows.length > 0) {
        const order = orderResult.rows[0];
        
        // Clear cart
        if (order.user_id) {
          await client.query('DELETE FROM cart_items WHERE user_id = $1', [order.user_id]);
        } else if (order.session_id) {
          await client.query('DELETE FROM cart_items WHERE session_id = $1', [order.session_id]);
        }

        await client.query('COMMIT');

        res.json({
          success: true,
          message: 'Payment confirmed and order completed',
          data: {
            orderId: order.id,
            paymentStatus: paymentIntent.status
          }
        });
      } else {
        await client.query('ROLLBACK');
        res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }
    } else {
      await client.query('ROLLBACK');
      res.status(400).json({
        success: false,
        message: 'Payment not successful',
        data: {
          paymentStatus: paymentIntent.status
        }
      });
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error confirming payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm payment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// Get checkout session info
router.get('/session/:paymentIntentId', extractUserOrSession, async (req, res) => {
  try {
    const { paymentIntentId } = req.params;

    // Get order details
    const orderQuery = `
      SELECT id, total_amount, status, items, created_at
      FROM orders
      WHERE payment_intent_id = $1
      AND (user_id = $2 OR session_id = $3)
    `;
    
    const orderResult = await pool.query(orderQuery, [
      paymentIntentId,
      req.session?.userId || null,
      req.sessionId || null
    ]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Checkout session not found'
      });
    }

    const order = orderResult.rows[0];

    res.json({
      success: true,
      data: {
        orderId: order.id,
        totalAmount: order.total_amount,
        status: order.status,
        items: order.items,
        createdAt: order.created_at
      }
    });

  } catch (error) {
    console.error('Error fetching checkout session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch checkout session',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;