const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  pricingPlans: {
    hourly: {
      type: Number,
      default: null,
    },
    daily: {
      type: Number,
      default: null,
    },
    weekly: {
      type: Number,
      default: null,
    },
    monthly: {
      type: Number,
      default: null,
    },
    yearly: {
      type: Number,
      default: null,
    },
  },
  duration: {
    type: Number, // in minutes
    required: true,
  },
  image: {
    type: String,
  },
  category: {
    type: String,
    enum: ['deep-cleaning', 'regular-cleaning', 'move-in-out', 'office-cleaning', 'post-construction', 'quick-service'],
    required: true,
  },
  isQuickService: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Service', serviceSchema);

