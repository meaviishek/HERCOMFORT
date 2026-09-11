import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('[MongoDB] Connected successfully');
  } catch (error) {
    console.warn('[MongoDB] Connection failed:', error.message);
  }
};

export { connectDB };
