require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function createAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/zynkly');
    console.log('✅ Connected to MongoDB\n');

    // Get email from command line argument
    const email = process.argv[2];

    if (!email) {
      console.log('❌ Error: Please provide an email address');
      console.log('\n📝 Usage:');
      console.log('   node scripts/createAdmin.js <email@example.com>');
      console.log('\n📝 Example:');
      console.log('   node scripts/createAdmin.js admin@zynkly.com');
      process.exit(1);
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.log(`❌ User with email "${email}" not found!`);
      console.log('\n💡 Please register this user first:');
      console.log('   1. Go to your app and register with this email');
      console.log('   2. Then run this script again to make them admin');
      process.exit(1);
    }

    // Check if already admin
    if (user.role === 'admin') {
      console.log(`✅ User "${user.name}" (${user.email}) is already an admin!`);
      process.exit(0);
    }

    // Update user role to admin
    user.role = 'admin';
    await user.save();

    console.log(`✅ Success! User "${user.name}" (${user.email}) is now an admin!`);
    console.log('\n📋 User Details:');
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log('\n🚀 You can now login to the admin panel at /admin');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 11000) {
      console.error('   User with this email already exists');
    }
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

createAdmin();

