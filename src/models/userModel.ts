import { Schema, model, Document } from 'mongoose';


export interface IUser extends Document {
  email: string;
  password: string;
  role: 'customer' | 'admin' | 'partner';
  firstName?: string;
  lastName?: string;
  apiKey?: string;
  isActive: boolean;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['customer', 'admin', 'partner'], required: true },
  firstName: { type: String },
  lastName: { type: String },
  apiKey: { type: String },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export const User = model<IUser>('User', UserSchema);