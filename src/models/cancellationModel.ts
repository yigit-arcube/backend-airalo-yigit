import { Schema, model, Document } from 'mongoose';


export interface ICancellation extends Document {
  orderId: string;
  productId: string;
  pnr: string;
  provider: string;
  cancellationId: string;
  requestedAt: Date;
  status: 'pending' | 'success' | 'failed' | 'denied';
  refundAmount: number;
  cancellationFee: number;
  refundPercentage: number;
  vendorResponse: any;
  emailSent: boolean;
  processedAt?: Date;
  requestSource: string;
  requestedBy?: {
    userId: string;
    userRole: string;
  };
}

const CancellationSchema = new Schema<ICancellation>({
  orderId: { type: String, required: true },
  productId: { type: String, required: true },
  pnr: { type: String, required: true },
  provider: { type: String, required: true },
  cancellationId: { type: String, required: true, unique: true },
  requestedAt: { type: Date, default: Date.now },
  status: { 
    type: String, 
    enum: ['pending', 'success', 'failed', 'denied'],
    default: 'pending'
  },
  refundAmount: { type: Number, default: 0 },
  cancellationFee: { type: Number, default: 0 },
  refundPercentage: { type: Number, default: 0 },
  vendorResponse: { type: Schema.Types.Mixed },
  emailSent: { type: Boolean, default: false },
  processedAt: { type: Date },
  requestSource: { type: String, required: true },
  requestedBy: {
    userId: { type: String },
    userRole: { type: String }
  }
}, { timestamps: true });

export const Cancellation = model<ICancellation>('Cancellation', CancellationSchema);