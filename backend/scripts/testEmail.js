require('dotenv').config();
const { sendWelcomeEmail, sendLoginEmail } = require('../utils/emailService');

async function testEmail() {
  console.log('\n🧪 Testing Nodemailer Configuration...\n');
  
  // Check if credentials are set
  const providerKey = (process.env.EMAIL_PROVIDER || 'brevo').toLowerCase();
  const provider = providerKey === 'gmail' ? 'gmail' : 'brevo';
  const providerLabel = provider === 'gmail' ? 'Gmail' : 'Brevo';
  const defaultHost = provider === 'gmail' ? 'smtp.gmail.com' : 'smtp-relay.brevo.com';

  console.log('📋 Configuration Check:');
  console.log('  EMAIL_PROVIDER:', providerLabel);
  console.log('  SMTP_HOST:', process.env.SMTP_HOST || `${defaultHost} (default)`);
  console.log('  SMTP_PORT:', process.env.SMTP_PORT || '587 (default)');
  console.log('  SMTP_USER:', process.env.SMTP_USER ? '✅ SET' : '❌ NOT SET');
  console.log('  SMTP_PASS:', process.env.SMTP_PASS ? '✅ SET' : '❌ NOT SET');
  console.log('  SENDER_EMAIL:', process.env.SENDER_EMAIL ? '✅ SET' : (provider === 'brevo' ? '⚠️ NOT SET (recommended for Brevo)' : 'ℹ️ NOT SET (optional)'));
  console.log(
    '  SMTP_SECURE:',
    process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE === 'true'
        ? '✅ true'
        : '⚠️ false'
      : process.env.SMTP_PORT === '465'
      ? '✅ inferred true (port 465)'
      : 'ℹ️ default false (port 587)'
  );
  console.log('');

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('❌ ERROR: SMTP credentials are missing!');
    console.log('\n📝 To fix this:');
    console.log('1. Open backend/.env file');
    console.log('2. Add these lines:');
    console.log(`   SMTP_HOST=${defaultHost}`);
    console.log('   SMTP_PORT=587');
    if (provider === 'gmail') {
      console.log('   SMTP_USER=your_gmail_address@gmail.com');
      console.log('   SMTP_PASS=your_gmail_app_password');
      console.log('\n💡 Gmail setup:');
      console.log('   - Enable 2FA on your Google account');
      console.log('   - Generate an App Password (Google Account → Security → App Passwords)');
      console.log('   - Use that 16-character password as SMTP_PASS');
    } else {
      console.log('   SMTP_USER=your_brevo_smtp_login (e.g., 9c6289001@smtp-brevo.com)');
      console.log('   SMTP_PASS=your_brevo_smtp_key');
      console.log('   SENDER_EMAIL=your_validated_email@example.com');
      console.log('\n💡 Brevo setup:');
      console.log('   - Visit Brevo dashboard → SMTP & API → SMTP');
      console.log('   - Copy the SMTP login (SMTP_USER) and generate a new SMTP key (SMTP_PASS)');
      console.log('   - IMPORTANT: Set SENDER_EMAIL to a real email address you own and have validated');
      console.log('   - Validate your sender email in Brevo dashboard → Senders & IP → Senders');
      console.log('   - Without a validated SENDER_EMAIL, emails may be rejected');
    }
    process.exit(1);
  }

  // Check for SENDER_EMAIL warning
  if (provider === 'brevo' && !process.env.SENDER_EMAIL) {
    console.log('⚠️  WARNING: SENDER_EMAIL is not set for Brevo!');
    console.log('⚠️  Your SMTP_USER may not be a valid sender address.');
    console.log('⚠️  Set SENDER_EMAIL to a validated email address in your .env file.');
    console.log('⚠️  See Brevo dashboard → Senders & IP → Senders to validate a sender.\n');
  }

  // Test email - use SENDER_EMAIL if available, otherwise try SMTP_USER
  const testEmail = process.env.SENDER_EMAIL || process.env.SMTP_USER;
  const testName = 'Test User';

  console.log('📧 Sending test welcome email to:', testEmail);
  console.log('   (This may take a few seconds...)\n');

  try {
    const result = await sendWelcomeEmail(testEmail, testName);
    if (result) {
      console.log('✅ SUCCESS! Welcome email sent successfully!');
      console.log('   Message ID:', result.messageId);
      console.log('   Check your inbox:', testEmail);
    } else {
      console.log('⚠️  Email function returned null (check console for details)');
    }
  } catch (error) {
    console.log('❌ ERROR sending email:');
    console.log('   ', error.message);
    console.log('\n🔍 Common issues:');
    console.log('   1. Wrong SMTP credentials');
    console.log(
      provider === 'gmail'
        ? '   2. Gmail App Password not generated correctly / 2FA disabled'
        : '   2. Brevo SMTP key revoked or not yet activated'
    );
    if (provider === 'brevo') {
      console.log('   3. SENDER_EMAIL not set or not validated in Brevo');
      console.log('   4. Using SMTP_USER as sender (must be a validated sender address)');
    }
    console.log('   5. Network/firewall blocking SMTP port 587/465');
    console.log('   6. Provider is rate-limiting or blocking the IP');
  }

  console.log('\n');
}

testEmail();


















