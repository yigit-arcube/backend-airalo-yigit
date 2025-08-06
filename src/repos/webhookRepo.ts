import { BaseRepository } from './baseRepo';
import { Webhook, IWebhook } from '../models/webhookModel';

export class WebhookRepository extends BaseRepository<IWebhook> {
  constructor() {
    super(Webhook);
  }

  // find active webhooks for specific events, ti is cancellation for this case
  async findActiveWebhooksByEvent(event: string): Promise<IWebhook[]> {
    return await this.model.find({
      events: event,
      isActive: true
    });
  }

  // create webhook with generated secret
  async createWebhook(data: any): Promise<IWebhook> {
    const secret = require('crypto').randomBytes(32).toString('hex');
    return await this.create({
      ...data,
      secret
    });
  }
}