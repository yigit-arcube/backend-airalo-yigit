import { Schema, model, Document } from 'mongoose';


export interface IWebhook extends Document {
  url: string;
  events: string[];
  isActive: boolean;
  secret: string;
  createdBy: string;
  createdAt: Date;
}

const WebhookSchema = new Schema<IWebhook>({
  url: { type: String, required: true },
  events: [{ type: String, required: true }],
  isActive: { type: Boolean, default: true },
  secret: { type: String, required: true },
  createdBy: { type: String, required: true }
}, { timestamps: true });

export const Webhook = model<IWebhook>('Webhook', WebhookSchema);