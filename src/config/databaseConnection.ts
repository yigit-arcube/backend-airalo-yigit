import mongoose from 'mongoose';

const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect('mongodb+srv://ardenelegbe:OyzJsquepTPnddwF@cluster1.hecc47a.mongodb.net/yigit?retryWrites=true&w=majority&appName=Cluster1');
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

export default connectDB;