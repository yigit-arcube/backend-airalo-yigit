import crypto from 'crypto';
import { WebhookRepository } from '../repos/webhookRepo';
import { EmailService } from './emailService';

export class WebhookService {
  private webhookRepo: WebhookRepository;
  private emailService: EmailService;

  constructor() {
    this.webhookRepo = new WebhookRepository();
    this.emailService = new EmailService();
  }

  // register webhook for admin notifications -- allows admins to get notified on specific events
  async registerWebhook(url: string, events: string[], createdBy: string): Promise<any> {
    try {
      const webhook = await this.webhookRepo.createWebhook({
        url,
        events,
        createdBy
      });

      console.log(`Webhook registered: ${webhook._id} for events: ${events.join(', ')}`);
      return {
        webhookId: webhook._id,
        secret: webhook.secret,
        events: webhook.events
      };
    } catch (error) {
      console.error('Failed to register webhook:', error);
      throw error;
    }
  }

  // trigger webhook notifications based on cancellation status -- main webhook execution logic
  async triggerWebhooks(event: string, data: any): Promise<void> {
    try {
      const webhooks = await this.webhookRepo.findActiveWebhooksByEvent(event);
      
      for (const webhook of webhooks) {
        await this.sendWebhookNotification(webhook, event, data);
      }
      
      // Also send email notification for critical events
      if (event.includes('failed') || event.includes('success')) {
        await this.sendEmailNotifications(event, data);
      }
    } catch (error) {
      console.error('Failed to trigger webhooks:', error);
    }
  }

  // send individual webhook notification with security signature
  private async sendWebhookNotification(webhook: any, event: string, data: any): Promise<void> {
    try {
      const payload = JSON.stringify({
        event,
        data,
        timestamp: new Date().toISOString(),
        webhookId: webhook._id
      });

      // generate secure signature for webhook verification
      const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(payload)
        .digest('hex');

      // in a real implementation, this would make an HTTP POST to webhook.url, for more appropriate approach
      console.log(`Webhook notification sent to ${webhook.url}`);
      console.log(`Event: ${event}, Signature: sha256=${signature}`);
      console.log(`Payload: ${payload}`);

      // mock HTTP call
      await this.mockHttpPost(webhook.url, payload, signature);

    } catch (error) {
      console.error(`Failed to send webhook to ${webhook.url}:`, error);
    }
  }

  // mock HTTP POST for webhook delivery -- simulates actual webhook delivery
  private async mockHttpPost(url: string, payload: string, signature: string): Promise<void> {
    // simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // simulate webhook delivery success/failure
    const success = Math.random() > 0.1; // 90% success rate
    
    if (success) {
      console.log(`✓ Webhook delivered successfully to ${url}`);
    } else {
      console.log(`✗ Webhook delivery failed to ${url}`);
      throw new Error('Webhook delivery failed');
    }
  }

  // Send email notifications for webhook events -- fallback notification method
  private async sendEmailNotifications(event: string, data: any): Promise<void> {
    try {
      // Get admin email from environment or use default
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@arcube.com';
      
      await this.emailService.sendAdminNotification(adminEmail, {
        status: event,
        cancellationId: data.cancellationId,
        orderId: data.orderId,
        productId: data.productId,
        refundAmount: data.refundAmount,
        message: data.message
      });
    } catch (error) {
      console.error('Failed to send email notification:', error);
    }
  }

  // Validate webhook signature for incoming requests -- security verification for webhook endpoints
  validateWebhookSignature(payload: string, signature: string, secret: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
      
      return `sha256=${expectedSignature}` === signature;
    } catch (error) {
      console.error('Failed to validate webhook signature:', error);
      return false;
    }
  }

  // Get all registered webhooks for admin management
  async getWebhooks(): Promise<any[]> {
    try {
      const webhooks = await this.webhookRepo.findAll();
      return webhooks.map(webhook => ({
        id: webhook._id,
        url: webhook.url,
        events: webhook.events,
        isActive: webhook.isActive,
        createdAt: webhook.createdAt
      }));
    } catch (error) {
      console.error('Failed to get webhooks:', error);
      return [];
    }
  }

  // Deactivate webhook -- admin function to disable problematic webhooks
  async deactivateWebhook(webhookId: string): Promise<boolean> {
    try {
      const webhook = await this.webhookRepo.update(webhookId, { isActive: false });
      return !!webhook;
    } catch (error) {
      console.error('Failed to deactivate webhook:', error);
      return false;
    }
  }
}