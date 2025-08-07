import { Router } from 'express';
import { WebhookService } from '../services/webhookService';
import { authenticateJWT, authorize, createRateLimit } from '../auth/auth';

const router = Router();
const webhookService = new WebhookService();

// rate limit for webhook management endpoints
const webhookRateLimit = createRateLimit(60 * 1000, 20); // 20 requests per minute, simple rate limitaion

// register new webhook for admin notifications
router.post('/register', 
  webhookRateLimit,
  authenticateJWT, 
  authorize(['admin']), 
  async (req, res) => {
    try {
      const { url, events } = req.body;

      if (!url || !events || !Array.isArray(events)) {
        return res.status(400).json({
          success: false,
          error: 'webhook url and events array required'
        });
      }

      // validate webhook url format
      try {
        new URL(url);
      } catch {
        return res.status(400).json({
          success: false,
          error: 'invalid webhook url format'
        });
      }

      // validate event types
      const validEvents = [
        'cancellation.success',
        'cancellation.failed', 
        'cancellation.error',
        'order.failed',           
        'order.partner_cancelled' //2 new events added, for feature support
      ];
      
      const invalidEvents = events.filter((event: string) => !validEvents.includes(event));
      if (invalidEvents.length > 0) {
        return res.status(400).json({
          success: false,
          error: `invalid events: ${invalidEvents.join(', ')}`
        });
      }

      const webhook = await webhookService.registerWebhook(url, events, req.user.id);

      console.log(`webhook registered by admin ${req.user.email}: ${url}`);

      res.json({
        success: true,
        data: {
          webhookId: webhook.webhookId,
          secret: webhook.secret,
          events: webhook.events,
          message: 'webhook registered successfully'
        }
      });

    } catch (error) {
      console.error('webhook registration failed:', error);
      res.status(500).json({
        success: false,
        error: 'webhook registration failed'
      });
    }
  }
);

// list all registered webhooks for admin management
router.get('/list', 
  authenticateJWT, 
  authorize(['admin']), 
  async (req, res) => {
    try {
      const webhooks = await webhookService.getWebhooks();

      res.json({
        success: true,
        data: {
          webhooks,
          count: webhooks.length
        }
      });

    } catch (error) {
      console.error('webhook listing failed:', error);
      res.status(500).json({
        success: false,
        error: 'failed to retrieve webhooks'
      });
    }
  }
);

// deactivate webhook to stop notifications
router.post('/:webhookId/deactivate', 
  authenticateJWT, 
  authorize(['admin']), 
  async (req, res) => {
    try {
      const { webhookId } = req.params;
      
      if (!webhookId) {
        return res.status(400).json({
          success: false,
          error: 'webhook id is required'
        });
      }
      
      const success = await webhookService.deactivateWebhook(webhookId);
      
      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'webhook not found'
        });
      }

      console.log(`webhook deactivated by admin ${req.user.email}: ${webhookId}`);

      res.json({
        success: true,
        data: {
          message: 'webhook deactivated successfully'
        }
      });

    } catch (error) {
      console.error('webhook deactivation failed:', error);
      res.status(500).json({
        success: false,
        error: 'webhook deactivation failed'
      });
    }
  }
);

export default router;