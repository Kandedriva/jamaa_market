const express = require('express');
const { pool } = require('../config/database');
const { authenticateSession } = require('./auth');

const router = express.Router();

// GET user notifications
router.get('/', authenticateSession(), async (req, res) => {
  try {
    const userId = req.user.userId;
    const { type, unread } = req.query;

    let query = `
      SELECT id, title, message, type, is_read, action_link, created_at
      FROM notifications 
      WHERE user_id = $1
    `;
    const queryParams = [userId];

    // Add filters
    if (type) {
      query += ` AND type = $${queryParams.length + 1}`;
      queryParams.push(type);
    }

    if (unread === 'true') {
      query += ` AND is_read = false`;
    }

    query += ` ORDER BY created_at DESC LIMIT 50`;

    const result = await pool.query(query, queryParams);

    res.json({
      success: true,
      data: result.rows.map(notification => ({
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        isRead: notification.is_read,
        actionLink: notification.action_link,
        createdAt: notification.created_at
      }))
    });

  } catch (error) {
    console.error('Error fetching notifications:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications'
    });
  }
});

// POST mark notification as read
router.post('/:id/mark-read', authenticateSession(), async (req, res) => {
  try {
    const userId = req.user.userId;
    const notificationId = req.params.id;

    const result = await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING id',
      [notificationId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('Error marking notification as read:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
});

// POST mark all notifications as read
router.post('/mark-all-read', authenticateSession(), async (req, res) => {
  try {
    const userId = req.user.userId;

    await pool.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [userId]
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });

  } catch (error) {
    console.error('Error marking all notifications as read:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read'
    });
  }
});

// DELETE notification
router.delete('/:id', authenticateSession(), async (req, res) => {
  try {
    const userId = req.user.userId;
    const notificationId = req.params.id;

    const result = await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id',
      [notificationId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting notification:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification'
    });
  }
});

// POST create notification (internal use for system notifications)
router.post('/create', authenticateSession(), async (req, res) => {
  try {
    const { userId, title, message, type, actionLink } = req.body;

    // Validate required fields
    if (!userId || !title || !message || !type) {
      return res.status(400).json({
        success: false,
        message: 'userId, title, message, and type are required'
      });
    }

    const result = await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, action_link, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, false, CURRENT_TIMESTAMP)
       RETURNING *`,
      [userId, title, message, type, actionLink || null]
    );

    res.status(201).json({
      success: true,
      data: {
        id: result.rows[0].id,
        title: result.rows[0].title,
        message: result.rows[0].message,
        type: result.rows[0].type,
        isRead: result.rows[0].is_read,
        actionLink: result.rows[0].action_link,
        createdAt: result.rows[0].created_at
      }
    });

  } catch (error) {
    console.error('Error creating notification:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to create notification'
    });
  }
});

module.exports = router;