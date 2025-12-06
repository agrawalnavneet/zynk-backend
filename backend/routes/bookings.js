const express = require('express');
const Booking = require('../models/Booking');
const Service = require('../models/Service');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { sendBookingConfirmationEmail } = require('../utils/emailService');

const router = express.Router();

// Get all bookings (user's own bookings or all if admin)
router.get('/', auth, async (req, res) => {
  try {
    const user = await require('../models/User').findById(req.user.userId);
    let bookings;

    if (user.role === 'admin') {
      bookings = await Booking.find()
        .populate('user', 'name email phone')
        .populate('service')
        .sort({ createdAt: -1 });
    } else {
      bookings = await Booking.find({ user: req.user.userId })
        .populate('service')
        .sort({ createdAt: -1 });
    }

    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single booking
router.get('/:id', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('service');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check if user owns the booking or is admin
    const user = await require('../models/User').findById(req.user.userId);
    if (booking.user._id.toString() !== req.user.userId && user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create booking
router.post('/', auth, async (req, res) => {
  try {
    const { 
      serviceId, 
      date, 
      time, 
      address, 
      specialInstructions, 
      plan = 'one-time',
      bookingType = 'scheduled',
      recurringFrequency
    } = req.body;

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // Calculate price based on plan
    let totalPrice = service.price; // Default to one-time price
    if (plan !== 'one-time' && service.pricingPlans && service.pricingPlans[plan]) {
      totalPrice = service.pricingPlans[plan];
    }

    // For instant bookings, set date/time to now
    let bookingDate = date;
    let bookingTime = time;
    if (bookingType === 'instant') {
      bookingDate = new Date();
      bookingTime = new Date().toTimeString().slice(0, 5);
    }

    const booking = new Booking({
      user: req.user.userId,
      service: serviceId,
      date: bookingDate,
      time: bookingTime,
      address,
      plan,
      bookingType,
      recurringFrequency: bookingType === 'recurring' ? recurringFrequency : undefined,
      totalPrice,
      specialInstructions,
    });

    await booking.save();
    await booking.populate('service');
    await booking.populate('user', 'name email');

    // Send booking confirmation email (non-blocking)
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

    res.status(201).json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update booking status
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const user = await require('../models/User').findById(req.user.userId);

    // Only admin can update status, or user can cancel their own booking
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (user.role !== 'admin' && (status !== 'cancelled' || booking.user.toString() !== req.user.userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    booking.status = status;
    await booking.save();
    await booking.populate('service');

    res.json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

