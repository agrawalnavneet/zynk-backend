require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function createAdminUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/zynkly');
    console.log('✅ Connected to MongoDB\n');

    // Get credentials from command line arguments or use defaults
    const email = process.argv[2] || 'admin@zynkly.com';
    const password = process.argv[3] || 'admin123';
    const name = process.argv[4] || 'Admin User';

    console.log('📋 Creating admin user with the following credentials:');
    console.log(`   Name: ${name}`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}\n`);

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      console.log(`⚠️  User with email "${email}" already exists!`);
      console.log('🔄 Updating existing user to admin...\n');
      
      // Update existing user to admin
      existingUser.role = 'admin';
      if (password && password !== 'admin123') {
        // Only update password if a custom one was provided
        // Mark password as modified so it gets hashed by pre-save hook
        existingUser.password = password;
        existingUser.markModified('password');
        console.log('   Password will be updated...');
      }
      await existingUser.save();

      console.log(`✅ Success! User "${existingUser.name}" (${existingUser.email}) is now an admin!`);
    } else {
      // Create new admin user
      const adminUser = new User({
        name,
        email: email.toLowerCase(),
        password, // Will be hashed automatically by pre-save hook
        role: 'admin',
      });

      await adminUser.save();

      console.log(`✅ Success! Admin user created!`);
    }

    console.log('\n📋 Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Email:    ${email}`);
    console.log(`   Password: ${password}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🚀 You can now login to the admin panel:');
    console.log('   1. Go to your application login page');
    console.log('   2. Use the credentials above');
    console.log('   3. Click "Admin Panel" link in navbar after login');
    console.log('\n✨ Admin Panel URL: /admin');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 11000) {
      console.error('   User with this email already exists');
      console.error('   Run the script again to update existing user to admin');
    }
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

// Show usage if help is requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('\n📖 Usage:');
  console.log('   node scripts/createAdminUser.js [email] [password] [name]');
  console.log('\n📝 Examples:');
  console.log('   # Use default credentials (admin@zynkly.com / admin123)');
  console.log('   node scripts/createAdminUser.js');
  console.log('');
  console.log('   # Custom email');
  console.log('   node scripts/createAdminUser.js admin@example.com');
  console.log('');
  console.log('   # Custom email and password');
  console.log('   node scripts/createAdminUser.js admin@example.com MySecurePass123');
  console.log('');
  console.log('   # Custom email, password, and name');
  console.log('   node scripts/createAdminUser.js admin@example.com MySecurePass123 "Admin Name"');
  console.log('');
  process.exit(0);
}

createAdminUser();

