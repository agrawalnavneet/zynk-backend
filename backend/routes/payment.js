const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const auth = require('../middleware/auth');
const Booking = require('../models/Booking');
const { sendBookingConfirmationEmail } = require('../utils/emailService');

const router = express.Router();

// Initialize Razorpay only if credentials are available
let razorpay = null;

const initializeRazorpay = () => {
  if (!razorpay && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    // Check if keys are not placeholders
    const keyId = process.env.RAZORPAY_KEY_ID.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET.trim();
    
    if (keyId === 'your_razorpay_key_id' || keySecret === 'your_razorpay_key_secret' || 
        keyId === '' || keySecret === '') {
      console.error('❌ ERROR: Razorpay keys are not configured properly. Please update backend/.env file with LIVE keys.');
      return null;
    }
    
    // STRICT VALIDATION: Reject test keys - only allow LIVE keys
    if (keyId.startsWith('rzp_test_')) {
      console.error('❌ ERROR: Test keys detected! This application requires LIVE keys for production.');
      console.error('❌ Your Key ID starts with "rzp_test_" - Please use LIVE keys starting with "rzp_live_"');
      console.error('❌ Get LIVE keys from: https://dashboard.razorpay.com/app/keys');
      return null;
    }
    
    if (!keyId.startsWith('rzp_live_')) {
      console.error('❌ ERROR: Invalid Razorpay Key ID format. Key must start with "rzp_live_" for LIVE mode.');
      console.error('❌ Current Key ID:', keyId.substring(0, 20) + '...');
      return null;
    }
    
    // Key Secret validation (it doesn't have a prefix, but we check it's not empty)
    if (keySecret.length < 20) {
      console.error('❌ ERROR: Invalid Razorpay Key Secret. Please check your LIVE key secret.');
      return null;
    }
    
    razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
    
    console.log('✅ Razorpay initialized in LIVE/PRODUCTION mode');
    console.log('✅ Key ID:', keyId.substring(0, 15) + '...');
    console.log('⚠️  WARNING: This is LIVE mode - all payments are REAL transactions!');
  }
  return razorpay;
};

// Create Razorpay order
router.post('/create-order', auth, async (req, res) => {
  try {
    // Check if Razorpay is configured (LIVE mode only)
    const razorpayInstance = initializeRazorpay();
    if (!razorpayInstance) {
      const keyId = process.env.RAZORPAY_KEY_ID || '';
      let errorMessage = 'Payment gateway not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (LIVE keys) in backend/.env file.';
      
      if (keyId.startsWith('rzp_test_')) {
        errorMessage = 'Test keys detected! This application requires LIVE keys. Please update backend/.env with LIVE keys starting with "rzp_live_". Get them from: https://dashboard.razorpay.com/app/keys';
      } else if (keyId && !keyId.startsWith('rzp_live_')) {
        errorMessage = 'Invalid key format. Keys must start with "rzp_live_" for LIVE mode. Please check your backend/.env file.';
      }
      
      return res.status(503).json({ 
        message: errorMessage,
        error: 'RAZORPAY_NOT_CONFIGURED'
      });
    }

    const { amount, currency = 'INR' } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    const options = {
      amount: amount * 100, // Convert to paise (Razorpay expects amount in smallest currency unit)
      currency,
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpayInstance.orders.create(options);

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    const errorMessage = error.error?.description || error.message || 'Error creating payment order';
    res.status(500).json({ message: errorMessage });
  }
});

// Verify payment and update booking
router.post('/verify-payment', auth, async (req, res) => {
  try {
    // Check if Razorpay is configured (LIVE mode only)
    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({ 
        message: 'Payment gateway not configured. Please set RAZORPAY_KEY_SECRET (LIVE key) in environment variables.' 
      });
    }
    
    // Validate key secret is not a test key (basic check)
    const keyId = process.env.RAZORPAY_KEY_ID || '';
    if (keyId.startsWith('rzp_test_')) {
      return res.status(503).json({ 
        message: 'Test keys detected! This application requires LIVE keys. Please update your environment variables with LIVE keys.' 
      });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingIds } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing payment details' });
    }

    // Verify signature
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ message: 'Payment verification failed' });
    }

    // Update booking payment status
    if (bookingIds && Array.isArray(bookingIds)) {
      await Booking.updateMany(
        { _id: { $in: bookingIds } },
        {
          paymentStatus: 'paid',
          paymentId: razorpay_payment_id,
          razorpayOrderId: razorpay_order_id,
          status: 'confirmed',
        }
      );

      // Send confirmation emails for all confirmed bookings (non-blocking)
      const confirmedBookings = await Booking.find({ _id: { $in: bookingIds } })
        .populate('service')
        .populate('user', 'name email');

      for (const booking of confirmedBookings) {
        if (booking.user && booking.user.email) {
          sendBookingConfirmationEmail(
            booking.user.email,
            booking.user.name,
            {
              service: booking.service,
              date: booking.date,
              time: booking.time,
              address: booking.address,
              totalPrice: booking.totalPrice,
              plan: booking.plan,
              bookingType: booking.bookingType,
              status: booking.status,
              specialInstructions: booking.specialInstructions,
            }
          ).catch((err) => {
            console.error('Failed to send booking confirmation email:', err);
          });
        }
      }
    }

    res.json({
      success: true,
      message: 'Payment verified successfully',
      paymentId: razorpay_payment_id,
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    const errorMessage = error.message || 'Error verifying payment';
    res.status(500).json({ message: errorMessage });
  }
});

module.exports = router;

