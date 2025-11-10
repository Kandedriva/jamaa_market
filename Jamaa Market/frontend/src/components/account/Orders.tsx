import React, { useState } from 'react';

interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  user_type: 'customer' | 'admin' | 'store_owner';
  store?: any;
}

interface OrdersProps {
  user: User;
}

interface OrderItem {
  id: number;
  productName: string;
  quantity: number;
  price: number;
  imageUrl: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  items: OrderItem[];
  total: number;
  shippingAddress: string;
  paymentMethod: string;
  orderDate: string;
  estimatedDelivery?: string;
  trackingNumber?: string;
}

const Orders: React.FC<OrdersProps> = ({ user }) => {
  // Mock order data
  const [orders] = useState<Order[]>([
    {
      id: '1',
      orderNumber: 'JM2024001',
      status: 'shipped',
      items: [
        {
          id: 1,
          productName: 'Wireless Bluetooth Headphones',
          quantity: 1,
          price: 79.99,
          imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=150&h=150&fit=crop&crop=center'
        },
        {
          id: 2,
          productName: 'USB-C Charging Cable',
          quantity: 2,
          price: 15.99,
          imageUrl: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=150&h=150&fit=crop&crop=center'
        }
      ],
      total: 111.97,
      shippingAddress: '123 Main St, City, State 12345',
      paymentMethod: 'Credit Card ending in 4567',
      orderDate: '2024-11-07T10:30:00Z',
      estimatedDelivery: '2024-11-10T18:00:00Z',
      trackingNumber: 'TRK123456789'
    },
    {
      id: '2',
      orderNumber: 'JM2024000',
      status: 'delivered',
      items: [
        {
          id: 3,
          productName: 'Smartphone Stand',
          quantity: 1,
          price: 24.99,
          imageUrl: 'https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?w=150&h=150&fit=crop&crop=center'
        }
      ],
      total: 24.99,
      shippingAddress: '123 Main St, City, State 12345',
      paymentMethod: 'PayPal',
      orderDate: '2024-11-02T14:20:00Z',
      estimatedDelivery: '2024-11-05T18:00:00Z',
      trackingNumber: 'TRK987654321'
    },
    {
      id: '3',
      orderNumber: 'JM2024002',
      status: 'confirmed',
      items: [
        {
          id: 4,
          productName: 'Laptop Sleeve 13 inch',
          quantity: 1,
          price: 39.99,
          imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=150&h=150&fit=crop&crop=center'
        },
        {
          id: 5,
          productName: 'Wireless Mouse',
          quantity: 1,
          price: 29.99,
          imageUrl: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=150&h=150&fit=crop&crop=center'
        }
      ],
      total: 69.98,
      shippingAddress: '123 Main St, City, State 12345',
      paymentMethod: 'Credit Card ending in 4567',
      orderDate: '2024-11-08T09:15:00Z',
      estimatedDelivery: '2024-11-12T18:00:00Z'
    }
  ]);

  const [selectedStatus, setSelectedStatus] = useState<'all' | Order['status']>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const filteredOrders = orders.filter(order => 
    selectedStatus === 'all' || order.status === selectedStatus
  );

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'shipped':
        return 'bg-purple-100 text-purple-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'confirmed':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'shipped':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        );
      case 'delivered':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'cancelled':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (selectedOrder) {
    return (
      <div className="p-6">
        <div className="flex items-center mb-6">
          <button
            onClick={() => setSelectedOrder(null)}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Orders</span>
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <div className="bg-white border rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Order {selectedOrder.orderNumber}</h3>
                  <p className="text-gray-600">Placed on {formatDate(selectedOrder.orderDate)}</p>
                </div>
                <span className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedOrder.status)}`}>
                  {getStatusIcon(selectedOrder.status)}
                  <span className="capitalize">{selectedOrder.status}</span>
                </span>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Order Items</h4>
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                    <img
                      src={item.imageUrl}
                      alt={item.productName}
                      className="w-16 h-16 object-cover rounded"
                    />
                    <div className="flex-1">
                      <h5 className="font-medium text-gray-900">{item.productName}</h5>
                      <p className="text-gray-600">Quantity: {item.quantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">${item.price.toFixed(2)}</p>
                      <p className="text-sm text-gray-600">Total: ${(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {selectedOrder.trackingNumber && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Tracking Information</h4>
                  <p className="text-blue-800">Tracking Number: <span className="font-mono">{selectedOrder.trackingNumber}</span></p>
                  <button className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
                    Track Package →
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white border rounded-lg p-6">
              <h4 className="font-medium text-gray-900 mb-4">Order Summary</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="text-gray-900">${selectedOrder.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping</span>
                  <span className="text-gray-900">Free</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between font-medium">
                    <span className="text-gray-900">Total</span>
                    <span className="text-gray-900">${selectedOrder.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border rounded-lg p-6">
              <h4 className="font-medium text-gray-900 mb-4">Shipping Address</h4>
              <p className="text-gray-600">{selectedOrder.shippingAddress}</p>
            </div>

            <div className="bg-white border rounded-lg p-6">
              <h4 className="font-medium text-gray-900 mb-4">Payment Method</h4>
              <p className="text-gray-600">{selectedOrder.paymentMethod}</p>
            </div>

            {selectedOrder.estimatedDelivery && (
              <div className="bg-white border rounded-lg p-6">
                <h4 className="font-medium text-gray-900 mb-4">Estimated Delivery</h4>
                <p className="text-gray-600">{formatDate(selectedOrder.estimatedDelivery)}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Orders</h2>
          <p className="text-gray-600 mt-1">Track and manage your orders</p>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
        {[
          { key: 'all', label: 'All Orders' },
          { key: 'pending', label: 'Pending' },
          { key: 'confirmed', label: 'Confirmed' },
          { key: 'shipped', label: 'Shipped' },
          { key: 'delivered', label: 'Delivered' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelectedStatus(tab.key as any)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedStatus === tab.key
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
            <p className="text-gray-500">You haven't placed any orders yet.</p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white border rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedOrder(order)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div>
                    <h3 className="font-medium text-gray-900">Order {order.orderNumber}</h3>
                    <p className="text-sm text-gray-600">Placed on {formatDate(order.orderDate)}</p>
                  </div>
                  <span className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                    {getStatusIcon(order.status)}
                    <span className="capitalize">{order.status}</span>
                  </span>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">${order.total.toFixed(2)}</p>
                  <p className="text-sm text-gray-600">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                {order.items.slice(0, 3).map((item) => (
                  <img
                    key={item.id}
                    src={item.imageUrl}
                    alt={item.productName}
                    className="w-12 h-12 object-cover rounded"
                  />
                ))}
                {order.items.length > 3 && (
                  <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                    <span className="text-sm text-gray-600">+{order.items.length - 3}</span>
                  </div>
                )}
                <div className="flex-1"></div>
                <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                  View Details →
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Orders;