const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  otp: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['registration', 'password-reset'],
    default: 'registration',
  },
  expiresAt: {
    type: Date,
    required: true,
    default: Date.now,
    expires: 600, // OTP expires in 10 minutes (600 seconds)
  },
  attempts: {
    type: Number,
    default: 0,
    max: 5, // Maximum 5 verification attempts
  },
  verified: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Index for faster lookups
otpSchema.index({ email: 1, type: 1, expiresAt: 1 });

// Clean up expired OTPs automatically
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OTP', otpSchema);

