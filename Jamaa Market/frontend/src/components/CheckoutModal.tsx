import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import CheckoutForm from './CheckoutForm';
import { useCart } from '../context/CartContext';
import axios from '../utils/axios';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY!);

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { state, getTotalPrice, user } = useCart();
  const [clientSecret, setClientSecret] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && state.items.length > 0) {
      createPaymentIntent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, state.items]);

  const createPaymentIntent = async () => {
    try {
      setLoading(true);
      setError(null);

      const headers = user 
        ? {}  // For authenticated users, session will be sent via cookies
        : { 'X-Session-Id': getSessionId() };

      const response = await axios.post(
        '/checkout/process',
        {},
        { 
          headers
          // withCredentials is set globally in axios config
        }
      );

      if (response.data.success) {
        setClientSecret(response.data.data.clientSecret);
      } else {
        setError(response.data.message || 'Failed to create payment intent');
      }
    } catch (error: any) {
      console.error('Error creating payment intent:', error);
      setError(
        error.response?.data?.message || 
        'Failed to initialize checkout. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const getSessionId = (): string => {
    let sessionId = localStorage.getItem('afrozy_session_id');
    if (!sessionId) {
      sessionId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('afrozy_session_id', sessionId);
    }
    return sessionId;
  };

  const handlePaymentSuccess = async (paymentIntent: any) => {
    try {
      const headers = user 
        ? {}  // For authenticated users, session will be sent via cookies
        : { 'X-Session-Id': getSessionId() };

      await axios.post(
        '/checkout/confirm',
        { paymentIntentId: paymentIntent.id },
        { 
          headers
          // withCredentials is set globally in axios config
        }
      );

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error: any) {
      console.error('Error confirming payment:', error);
    }
  };

  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const appearance = {
    theme: 'stripe' as const,
    variables: {
      colorPrimary: '#2563eb',
      colorBackground: '#ffffff',
      colorText: '#1f2937',
      colorDanger: '#dc2626',
      fontFamily: 'system-ui, sans-serif',
      spacingUnit: '4px',
      borderRadius: '8px',
    },
    rules: {
      '.Tab': {
        display: 'none', // Hide tabs since we only have cards
      },
      '.TabIcon': {
        display: 'none',
      },
      '.TabLabel': {
        display: 'none',
      },
    },
  };

  const options = {
    clientSecret,
    appearance,
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-screen overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Checkout</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {state.items.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Your cart is empty</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Continue Shopping
            </button>
          </div>
        ) : (
          <>
            {/* Order Summary */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium mb-3">Order Summary</h3>
              <div className="space-y-2">
                {state.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>
                      {item.name} × {item.quantity}
                    </span>
                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-2 mt-3">
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>${getTotalPrice().toFixed(2)}</span>
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded-lg">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : clientSecret ? (
              <Elements options={options} stripe={stripePromise}>
                <CheckoutForm
                  clientSecret={clientSecret}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
              </Elements>
            ) : (
              <div className="text-center py-8">
                <button
                  onClick={createPaymentIntent}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Initialize Payment
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CheckoutModal;