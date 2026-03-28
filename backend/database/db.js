const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
    try {
        // 🔥 Disable buffering (fail fast instead of waiting)
        mongoose.set('bufferCommands', false);

        // 🔍 Debug (remove later)
        console.log("🔍 MONGO URI:", process.env.MONGODB_URI);

        if (!process.env.MONGODB_URI) {
            throw new Error("MONGODB_URI is not defined in .env");
        }

        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000, // fail fast
        });

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

        // 🔁 Events
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB Error:', err.message);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️ MongoDB Disconnected');
        });

        // 🛑 Graceful shutdown
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            console.log('🔴 MongoDB connection closed');
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ DB Connection Failed:', error.message);
        process.exit(1);
    }
};

module.exports = connectDB;