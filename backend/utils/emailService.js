require('dotenv').config();
const nodemailer = require('nodemailer');

// Check if email is configured
const isEmailConfigured = () => {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
};

// ✅ Only Gmail provider (no Brevo)
const PROVIDER_DEFAULTS = {
  gmail: {
    label: 'Gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // STARTTLS
  },
};

const getSMTPConfig = () => {
  // Default: gmail
  const providerKey = (process.env.EMAIL_PROVIDER || 'gmail').toLowerCase();
  let provider = PROVIDER_DEFAULTS[providerKey];

  // If someone sets wrong EMAIL_PROVIDER, fallback
  if (!provider) {
    console.warn(
      `⚠️  Unknown EMAIL_PROVIDER "${providerKey}", falling back to Gmail.`
    );
    provider = PROVIDER_DEFAULTS.gmail;
  }

  const host = process.env.SMTP_HOST || provider.host;
  const port = parseInt(process.env.SMTP_PORT, 10) || provider.port;

  const secure =
    process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE === 'true'
      : port === 465 || provider.secure;

  const smtpConfig = {
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,
  };

  // Force STARTTLS when secure=false
  if (!secure) {
    smtpConfig.requireTLS = true;
  }

  return {
    smtpConfig,
    providerLabel: provider.label,
  };
};

// Create transporter only if credentials are available
let transporter = null;
let transporterReady = false;
let transporterError = null;

// Initialize transporter
const initializeTransporter = async () => {
  if (!isEmailConfigured()) {
    console.log(
      '⚠️  Email service not configured. SMTP_USER and SMTP_PASS are required in .env file.'
    );
    console.log(
      '⚠️  Emails will not be sent until email credentials are configured.'
    );
    return false;
  }

  try {
    const { smtpConfig, providerLabel } = getSMTPConfig();

    console.log(
      `📧 Initializing email service (${providerLabel}) ${smtpConfig.host}:${smtpConfig.port}, secure=${smtpConfig.secure}`
    );

    transporter = nodemailer.createTransport(smtpConfig);

    // Verify transporter configuration
    await new Promise((resolve) => {
      transporter.verify((error, success) => {
        if (error) {
          transporterError = error;
          console.log('⚠️  Email service error:', error.message);
          console.log('error is error:----', error);
          console.log(
            '⚠️  Emails may not be sent. Please check your SMTP configuration.'
          );
          resolve(false);
        } else {
          transporterReady = true;
          console.log('✅ Email service is ready to send messages');
          resolve(true);
        }
      });
    });

    return transporterReady;
  } catch (error) {
    transporterError = error;
    console.error('❌ Error initializing email service:', error.message);
    return false;
  }
};

// Initialize transporter on module load
initializeTransporter().catch((err) => {
  console.error('❌ Failed to initialize email transporter:', err.message);
});

// Get or create transporter (with retry if failed before)
const getTransporter = async () => {
  if (!isEmailConfigured()) {
    return null;
  }

  // If transporter exists and is ready, return it
  if (transporter && transporterReady) {
    return transporter;
  }

  // If transporter exists but not ready, try to verify it
  if (transporter && !transporterReady) {
    try {
      await new Promise((resolve) => {
        transporter.verify((error, success) => {
          if (error) {
            console.log(
              '⚠️  Transporter verification failed, reinitializing...'
            );
            transporter = null;
            transporterReady = false;
            resolve(false);
          } else {
            transporterReady = true;
            resolve(true);
          }
        });
      });
      if (transporterReady) {
        return transporter;
      }
    } catch (error) {
      console.error('Error verifying transporter:', error.message);
      transporter = null;
      transporterReady = false;
    }
  }

  // Try to reinitialize if transporter doesn't exist or verification failed
  if (!transporter) {
    const initialized = await initializeTransporter();
    if (initialized && transporter) {
      return transporter;
    }
  }

  return null;
};

// Get sender email address - SENDER_EMAIL is preferred, fallback to SMTP_USER
const getSenderEmail = () => {
  if (process.env.SENDER_EMAIL) {
    return process.env.SENDER_EMAIL.trim();
  }

  if (process.env.SMTP_USER) {
    return process.env.SMTP_USER.trim();
  }

  throw new Error(
    'No sender email configured. Set SENDER_EMAIL or SMTP_USER in .env file.'
  );
};

// Send welcome email on signup
const sendWelcomeEmail = async (userEmail, userName) => {
  if (!isEmailConfigured()) {
    console.log('⚠️  Email not configured. Skipping welcome email to:', userEmail);
    return null;
  }

  const emailTransporter = await getTransporter();
  if (!emailTransporter) {
    console.log(
      '⚠️  Email transporter not available. Skipping welcome email to:',
      userEmail
    );
    if (transporterError) {
      console.error('   Last error:', transporterError.message);
    }
    return null;
  }

  try {
    const mailOptions = {
      from: `"Zynkly" <${getSenderEmail()}>`,
      to: userEmail,
      subject: 'Welcome to Zynkly! 🎉',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; }
            .header { background-color: #10b981; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: white; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Zynkly! 🎉</h1>
            </div>
            <div class="content">
              <h2>Hello ${userName},</h2>
              <p>Thank you for signing up with Zynkly! We're excited to have you on board.</p>
              <p>Your account has been successfully created. You can now:</p>
              <ul>
                <li>Browse our cleaning services</li>
                <li>Book appointments at your convenience</li>
                <li>Manage your bookings from your dashboard</li>
              </ul>
              <p>If you have any questions or need assistance, feel free to reach out to us.</p>
              <p>Best regards,<br>The Zynkly Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Zynkly. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Welcome to Zynkly!
        Hello ${userName},
        Thank you for signing up with Zynkly! We're excited to have you on board.
        Your account has been successfully created. You can now:
        - Browse our cleaning services
        - Book appointments at your convenience
        - Manage your bookings from your dashboard
        If you have any questions or need assistance, feel free to reach out to us.
        Best regards,
        The Zynkly Team
      `,
    };

    const info = await emailTransporter.sendMail(mailOptions);
    console.log('✅ Welcome email sent to:', userEmail);
    return info;
  } catch (error) {
    console.error('❌ Error sending welcome email:', error.message);
    console.error('   Full error:', error);
    if (error.code === 'EAUTH' || error.code === 'ECONNECTION') {
      transporterReady = false;
      transporterError = error;
    }
    return null;
  }
};

// Send login notification email
const sendLoginEmail = async (userEmail, userName, loginTime) => {
  if (!isEmailConfigured()) {
    console.log('⚠️  Email not configured. Skipping login email to:', userEmail);
    return null;
  }

  const emailTransporter = await getTransporter();
  if (!emailTransporter) {
    console.log(
      '⚠️  Email transporter not available. Skipping login email to:',
      userEmail
    );
    if (transporterError) {
      console.error('   Last error:', transporterError.message);
    }
    return null;
  }

  try {
    const mailOptions = {
      from: `"Zynkly" <${getSenderEmail()}>`,
      to: userEmail,
      subject: 'Login Notification - Zynkly',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; }
            .header { background-color: #10b981; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: white; padding: 30px; border-radius: 0 0 8px 8px; }
            .info-box { background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .warning { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 5px; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Login Notification 🔐</h1>
            </div>
            <div class="content">
              <h2>Hello ${userName},</h2>
              <p>This is to notify you that you have successfully logged into your Zynkly account.</p>
              <div class="info-box">
                <p><strong>Login Time:</strong> ${loginTime}</p>
              </div>
              <div class="warning">
                <p><strong>⚠️ Security Notice:</strong></p>
                <p>If you did not perform this login, please change your password immediately and contact our support team.</p>
              </div>
              <p>If you have any concerns about your account security, please don't hesitate to reach out to us.</p>
              <p>Best regards,<br>The Zynkly Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Zynkly. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Login Notification
        Hello ${userName},
        This is to notify you that you have successfully logged into your Zynkly account.
        Login Time: ${loginTime}
        Security Notice:
        If you did not perform this login, please change your password immediately and contact our support team.
        If you have any concerns about your account security, please don't hesitate to reach out to us.
        Best regards,
        The Zynkly Team
      `,
    };

    const info = await emailTransporter.sendMail(mailOptions);
    console.log('✅ Login email sent to:', userEmail);
    return info;
  } catch (error) {
    console.error('❌ Error sending login email:', error.message);
    console.error('   Full error:', error);
    if (error.code === 'EAUTH' || error.code === 'ECONNECTION') {
      transporterReady = false;
      transporterError = error;
    }
    return null;
  }
};

// Send booking confirmation email
const sendBookingConfirmationEmail = async (
  userEmail,
  userName,
  bookingData
) => {
  if (!isEmailConfigured()) {
    console.log(
      '⚠️  Email not configured. Skipping booking confirmation email to:',
      userEmail
    );
    return null;
  }

  const emailTransporter = await getTransporter();
  if (!emailTransporter) {
    console.log(
      '⚠️  Email transporter not available. Skipping booking confirmation email to:',
      userEmail
    );
    if (transporterError) {
      console.error('   Last error:', transporterError.message);
    }
    return null;
  }

  try {
    const {
      service,
      date,
      time,
      address,
      totalPrice,
      plan,
      bookingType,
      status,
      specialInstructions,
    } = bookingData;

    const bookingDate = new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const fullAddress = `${address.street}, ${address.city}, ${address.state} ${address.zipCode}`;

    const planNames = {
      'one-time': 'One-time',
      hourly: 'Hourly',
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
      yearly: 'Yearly',
    };
    const planName = planNames[plan] || plan;

    const bookingTypeNames = {
      instant: 'Instant',
      scheduled: 'Scheduled',
      recurring: 'Recurring',
    };
    const bookingTypeName = bookingTypeNames[bookingType] || bookingType;

    const statusNames = {
      pending: 'Pending',
      confirmed: 'Confirmed',
      'in-progress': 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };
    const statusName = statusNames[status] || status;

    const mailOptions = {
      from: `"Zynkly" <${getSenderEmail()}>`,
      to: userEmail,
      subject: `Booking Confirmation - ${service.name} 🎉`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; }
            .header { background-color: #10b981; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: white; padding: 30px; border-radius: 0 0 8px 8px; }
            .info-box { background-color: #f3f4f6; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
            .info-row:last-child { border-bottom: none; }
            .info-label { font-weight: bold; color: #6b7280; }
            .info-value { color: #111827; text-align: right; }
            .service-name { font-size: 24px; color: #10b981; font-weight: bold; margin: 20px 0; }
            .price-box { background-color: #d1fae5; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0; }
            .price-amount { font-size: 32px; font-weight: bold; color: #065f46; }
            .address-box { background-color: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; border-radius: 5px; }
            .status-badge {
              display: inline-block;
              padding: 8px 16px;
              border-radius: 20px;
              font-weight: bold;
              background-color: ${
                status === 'confirmed'
                  ? '#d1fae5'
                  : status === 'pending'
                  ? '#dbeafe'
                  : '#fee2e2'
              };
              color: ${
                status === 'confirmed'
                  ? '#065f46'
                  : status === 'pending'
                  ? '#1e40af'
                  : '#991b1b'
              };
            }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
            .instructions {
              background-color: #eff6ff;
              padding: 15px;
              border-left: 4px solid #3b82f6;
              margin: 20px 0;
              border-radius: 5px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Booking Confirmed! 🎉</h1>
            </div>
            <div class="content">
              <h2>Hello ${userName},</h2>
              <p>Thank you for booking with Zynkly! Your booking has been confirmed and we're excited to serve you.</p>
              <div class="service-name">${service.name}</div>
              <p style="color: #6b7280;">${service.description}</p>

              <div class="info-box">
                <div class="info-row">
                  <span class="info-label">Status:</span>
                  <span class="info-value"><span class="status-badge">${statusName}</span></span>
                </div>
                <div class="info-row">
                  <span class="info-label">Booking Date:</span>
                  <span class="info-value">${bookingDate}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Time:</span>
                  <span class="info-value">${time}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Plan:</span>
                  <span class="info-value">${planName}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Booking Type:</span>
                  <span class="info-value">${bookingTypeName}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Service Duration:</span>
                  <span class="info-value">${service.duration} minutes</span>
                </div>
              </div>

              <div class="price-box">
                <div style="color: #6b7280; margin-bottom: 5px;">Total Amount</div>
                <div class="price-amount">₹${totalPrice.toLocaleString('en-IN')}</div>
              </div>

              <div class="address-box">
                <strong style="color: #92400e; margin-bottom: 10px; display: block;">Service Address:</strong>
                <p style="margin: 0; color: #78350f;">${fullAddress}</p>
              </div>

              ${
                specialInstructions
                  ? `
              <div class="instructions">
                <strong style="color: #1e40af; margin-bottom: 10px; display: block;">Special Instructions:</strong>
                <p style="margin: 0; color: #1e3a8a;">${specialInstructions}</p>
              </div>
              `
                  : ''
              }

              <p style="margin-top: 30px;">We'll send you a reminder before your scheduled service. If you need to make any changes to your booking, please contact us or visit your dashboard.</p>
              <p style="margin-top: 20px;">Thank you for choosing Zynkly. We look forward to serving you!</p>
              <p style="margin-top: 20px;">Best regards,<br>The Zynkly Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Zynkly. All rights reserved.</p>
              <p>This is an automated confirmation email. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Booking Confirmed!
        Hello ${userName},
        Thank you for booking with Zynkly! Your booking has been confirmed and we're excited to serve you.
        Service: ${service.name}
        ${service.description}
        Booking Details:
        - Status: ${statusName}
        - Booking Date: ${bookingDate}
        - Time: ${time}
        - Plan: ${planName}
        - Booking Type: ${bookingTypeName}
        - Service Duration: ${service.duration} minutes
        - Total Amount: ₹${totalPrice.toLocaleString('en-IN')}
        Service Address:
        ${fullAddress}
        ${
          specialInstructions
            ? `Special Instructions:\n${specialInstructions}\n\n`
            : ''
        }
        We'll send you a reminder before your scheduled service. If you need to make any changes to your booking, please contact us or visit your dashboard.
        Thank you for choosing Zynkly. We look forward to serving you!
        Best regards,
        The Zynkly Team
        © ${new Date().getFullYear()} Zynkly. All rights reserved.
        This is an automated confirmation email. Please do not reply to this email.
      `,
    };

    const info = await emailTransporter.sendMail(mailOptions);
    console.log('✅ Booking confirmation email sent to:', userEmail);
    return info;
  } catch (error) {
    console.error(
      '❌ Error sending booking confirmation email:',
      error.message
    );
    console.error('   Full error:', error);
    if (error.code === 'EAUTH' || error.code === 'ECONNECTION') {
      transporterReady = false;
      transporterError = error;
    }
    return null;
  }
};

// Send OTP email for email verification
const sendOTPEmail = async (userEmail, otp) => {
  if (!isEmailConfigured()) {
    console.log('⚠️  Email not configured. Skipping OTP email to:', userEmail);
    return null;
  }

  const emailTransporter = await getTransporter();
  if (!emailTransporter) {
    console.log(
      '⚠️  Email transporter not available. Skipping OTP email to:',
      userEmail
    );
    if (transporterError) {
      console.error('   Last error:', transporterError.message);
    }
    return null;
  }

  try {
    const mailOptions = {
      from: `"Zynkly" <${getSenderEmail()}>`,
      to: userEmail,
      subject: 'Email Verification OTP - Zynkly',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; }
            .header { background-color: #10b981; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: white; padding: 30px; border-radius: 0 0 8px 8px; }
            .otp-box { background-color: #d1fae5; padding: 30px; border-radius: 8px; text-align: center; margin: 30px 0; border: 2px solid #10b981; }
            .otp-code { font-size: 48px; font-weight: bold; color: #065f46; letter-spacing: 8px; font-family: 'Courier New', monospace; }
            .warning { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 5px; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Email Verification 🔐</h1>
            </div>
            <div class="content">
              <h2>Hello,</h2>
              <p>Thank you for signing up with Zynkly! To complete your registration, please verify your email address using the OTP below.</p>
              <div class="otp-box">
                <p style="color: #065f46; margin-bottom: 10px; font-weight: 600;">Your Verification Code:</p>
                <div class="otp-code">${otp}</div>
              </div>

              <div class="warning">
                <p><strong>⚠️ Important:</strong></p>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>This OTP is valid for <strong>10 minutes</strong> only</li>
                  <li>Do not share this OTP with anyone</li>
                  <li>If you didn't request this, please ignore this email</li>
                </ul>
              </div>

              <p>Enter this code in the verification form to complete your registration.</p>
              <p style="margin-top: 30px;">Best regards,<br>The Zynkly Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Zynkly. All rights reserved.</p>
              <p>This is an automated email. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Email Verification - Zynkly
        Hello,
        Thank you for signing up with Zynkly! To complete your registration, please verify your email address using the OTP below.
        Your Verification Code: ${otp}
        Important:
        - This OTP is valid for 10 minutes only
        - Do not share this OTP with anyone
        - If you didn't request this, please ignore this email
        Enter this code in the verification form to complete your registration.
        Best regards,
        The Zynkly Team
        © ${new Date().getFullYear()} Zynkly. All rights reserved.
        This is an automated email. Please do not reply to this email.
      `,
    };

    const info = await emailTransporter.sendMail(mailOptions);
    console.log('✅ OTP email sent to:', userEmail);
    return info;
  } catch (error) {
    console.error('❌ Error sending OTP email:', error.message);
    console.error('   Full error:', error);
    if (error.code === 'EAUTH' || error.code === 'ECONNECTION') {
      transporterReady = false;
      transporterError = error;
    }
    throw error; // OTP is critical
  }
};

// Send password reset OTP email
const sendPasswordResetOTPEmail = async (userEmail, userName, otp) => {
  if (!isEmailConfigured()) {
    console.log(
      '⚠️  Email not configured. Skipping password reset OTP email to:',
      userEmail
    );
    return null;
  }

  const emailTransporter = await getTransporter();
  if (!emailTransporter) {
    console.log(
      '⚠️  Email transporter not available. Skipping password reset OTP email to:',
      userEmail
    );
    if (transporterError) {
      console.error('   Last error:', transporterError.message);
    }
    return null;
  }

  try {
    const mailOptions = {
      from: `"Zynkly" <${getSenderEmail()}>`,
      to: userEmail,
      subject: 'Password Reset Code - Zynkly',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; }
            .header { background-color: #ef4444; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: white; padding: 30px; border-radius: 0 0 8px 8px; }
            .otp-box { background-color: #fee2e2; padding: 30px; border-radius: 8px; text-align: center; margin: 30px 0; border: 2px solid #ef4444; }
            .otp-code { font-size: 48px; font-weight: bold; color: #991b1b; letter-spacing: 8px; font-family: 'Courier New', monospace; }
            .warning { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 5px; }
            .danger-warning { background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 5px; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request 🔒</h1>
            </div>
            <div class="content">
              <h2>Hello ${userName},</h2>
              <p>We received a request to reset your password for your Zynkly account. Use the verification code below to reset your password.</p>
              <div class="otp-box">
                <p style="color: #991b1b; margin-bottom: 10px; font-weight: 600;">Your Password Reset Code:</p>
                <div class="otp-code">${otp}</div>
              </div>

              <div class="warning">
                <p><strong>⚠️ Important:</strong></p>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>This code is valid for <strong>10 minutes</strong> only</li>
                  <li>Do not share this code with anyone</li>
                  <li>If you didn't request this, please ignore this email</li>
                </ul>
              </div>

              <div class="danger-warning">
                <p><strong>🔒 Security Notice:</strong></p>
                <p>If you didn't request a password reset, please secure your account immediately. Your password will remain unchanged if you don't use this code.</p>
              </div>

              <p>Enter this code in the password reset form to create a new password.</p>
              <p style="margin-top: 30px;">Best regards,<br>The Zynkly Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Zynkly. All rights reserved.</p>
              <p>This is an automated email. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Password Reset Request - Zynkly
        Hello ${userName},
        We received a request to reset your password for your Zynkly account. Use the verification code below to reset your password.
        Your Password Reset Code: ${otp}
        Important:
        - This code is valid for 10 minutes only
        - Do not share this code with anyone
        - If you didn't request this, please ignore this email
        Security Notice:
        If you didn't request a password reset, please secure your account immediately. Your password will remain unchanged if you don't use this code.
        Enter this code in the password reset form to create a new password.
        Best regards,
        The Zynkly Team
        © ${new Date().getFullYear()} Zynkly. All rights reserved.
        This is an automated email. Please do not reply to this email.
      `,
    };

    const info = await emailTransporter.sendMail(mailOptions);
    console.log('✅ Password reset OTP email sent to:', userEmail);
    return info;
  } catch (error) {
    console.error(
      '❌ Error sending password reset OTP email:',
      error.message
    );
    console.error('   Full error:', error);
    if (error.code === 'EAUTH' || error.code === 'ECONNECTION') {
      transporterReady = false;
      transporterError = error;
    }
    throw error; // critical
  }
};

module.exports = {
  sendWelcomeEmail,
  sendLoginEmail,
  sendBookingConfirmationEmail,
  sendOTPEmail,
  sendPasswordResetOTPEmail,
};
