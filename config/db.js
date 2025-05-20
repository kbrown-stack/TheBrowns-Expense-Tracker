//This is the Mongoose database configuration file.

require('dotenv').config();
const mongoose = require('mongoose');

// Create connectDB function
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
        });
        console.log('MongoDB connected');
    } catch (error) {
        console.error('MongoDB connection failed:', error.message);
        process.exit(1); // Exit the process with failure code
    }
};

// Export the function
module.exports = connectDB;