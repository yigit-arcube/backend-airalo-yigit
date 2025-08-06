import { Schema, model, Document } from 'mongoose';

export interface IProduct {
  id: string;
  title: string;
  provider: string;
  type: string;
  price: {
    amount: number;
    currency: string;
  };
  status: 'pending' | 'success' | 'failed' | 'denied' | 'confirmed' | 'cancelled';
  cancellationPolicy: {
    windows: Array<{
      hoursBeforeActivation?: number;
      refundPercentage: number;
      description: string;
    }>;
    canCancel: boolean;
    cancelCondition?: string;
  };
  serviceDateTime: Date;
  activationDeadline?: Date;
  simStatus?: 'ready_for_activation' | 'active' | 'cancelled';
  activatedAt?: Date;
  metadata: any;
}

export interface IOrder extends Document {
  pnr: string;
  transactionId: string;
  customerId: string; // added userid for easier product showin
  customer: {
    email: string;
    firstName: string;
    lastName: string;
  };
  products: IProduct[];
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>({
  id: { type: String, required: true },
  title: { type: String, required: true },
  provider: { type: String, required: true },
  type: { type: String, required: true },
  price: {
    amount: { type: Number, required: true },
    currency: { type: String, required: true }
  },
  status: { 
    type: String, 
    enum: ['pending', 'success', 'failed', 'denied', 'confirmed', 'cancelled'],
    default: 'pending'
  },
  cancellationPolicy: {
    windows: [{
      hoursBeforeActivation: { type: Number },
      refundPercentage: { type: Number, required: true },
      description: { type: String, required: true }
    }],
    canCancel: { type: Boolean, required: true },
    cancelCondition: { type: String }
  },
  serviceDateTime: { type: Date, required: true },
  activationDeadline: { type: Date },
  simStatus: {
    type: String,
    enum: ['ready_for_activation', 'active', 'cancelled'],
    default: 'ready_for_activation'
  },
  activatedAt: { type: Date },
  metadata: { type: Schema.Types.Mixed }
});

const OrderSchema = new Schema<IOrder>({
  pnr: { type: String, required: true, unique: true },
  transactionId: { type: String, required: true },
  customerId: { type: String, required: true }, 
  customer: {
    email: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true }
  },
  products: [ProductSchema],
  status: { type: String, default: 'confirmed' }
}, { timestamps: true });

export const Order = model<IOrder>('Order', OrderSchema);