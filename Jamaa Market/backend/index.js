const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { connectDB } = require('./config/database');
const createTables = require('./scripts/createTables');
const createUsersTable = require('./scripts/createUsersTable');
const createCartTable = require('./scripts/createCartTable');
const createStoresTable = require('./scripts/createStoresTable');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Jamaa Market API is running!' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Products routes
const productRoutes = require('./routes/products');
app.use('/api/products', productRoutes);

// Admin routes
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// Authentication routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Cart routes
const cartRoutes = require('./routes/cart');
app.use('/api/cart', cartRoutes);

// Notifications routes
const notificationRoutes = require('./routes/notifications');
app.use('/api/notifications', notificationRoutes);

// Orders routes
const orderRoutes = require('./routes/orders');
app.use('/api/orders', orderRoutes);

// Driver routes
const driverRoutes = require('./routes/drivers');
app.use('/api/drivers', driverRoutes);

// Store routes
const storeRoutes = require('./routes/store');
app.use('/api/store', storeRoutes);

const startServer = async () => {
  try {
    await connectDB();
    await createTables();
    await createUsersTable();
    await createCartTable();
    await createStoresTable();
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();