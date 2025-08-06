import { Request, Response, NextFunction } from 'express';
import { OrderService } from '../services/orderService';
import { AiraloCancellationCommand } from '../requestCancellation/airaloCancellation';
import { CancellationCommandInvoker } from '../requestCancellation/cancellationRequest';
import { WebhookService } from '../services/webhookService';
import { EmailService } from '../services/emailService';

const orderService = new OrderService();
const commandInvoker = new CancellationCommandInvoker();
const webhookService = new WebhookService();
const emailService = new EmailService();

// create new order for testing cancellation functionality
export const createOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const correlationId = req.correlationId || 'unknown';
  
  try {
    const { customer, products } = req.body;

    if (!customer || !customer.email || !customer.firstName || !customer.lastName) {
      res.status(400).json({
        success: false,
        error: 'customer information (email, firstName, lastName) required'
      });
      return;
    }

    if (!products || !Array.isArray(products) || products.length === 0) {
      res.status(400).json({
        success: false,
        error: 'at least one product required'
      });
      return;
    }

    if (!req.user || !req.user.userId) {
      res.status(401).json({
        success: false,
        error: 'user authentication required'
      });
      return;
    }

    console.log(`[${correlationId}] creating order for customer: ${customer.email}, user id: ${req.user.userId}`);

    const order = await orderService.createOrder({ customer, products }, req.user.userId);

    console.log(`[${correlationId}] order created successfully: ${order.pnr}`);

    res.status(201).json({
      success: true,
      data: {
        orderId: order._id,
        pnr: order.pnr,
        transactionId: order.transactionId,
        customer: order.customer,
        products: order.products.map(p => ({
          id: p.id,
          title: p.title,
          price: p.price,
          status: p.status,
          simStatus: p.simStatus
        })),
        createdAt: order.createdAt
      }
    });

  } catch (error) {
    console.error(`[${correlationId}] order creation failed:`, error);
    next(error);
  }
};

// get order details by pnr
export const getOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const correlationId = req.correlationId || 'unknown';
  
  try {
    const { pnr } = req.params;
    const { email } = req.query;

    if (!pnr) {
      res.status(400).json({
        success: false,
        error: 'pnr required'
      });
      return;
    }

    console.log(`[${correlationId}] retrieving order: ${pnr}`);

    let order;
    if (req.user && (req.user.role === 'admin' || req.user.role === 'partner')) {
      order = await orderService.findOrderByPnr(pnr);
    } else {
      if (!email) {
        res.status(400).json({
          success: false,
          error: 'customer email required'
        });
        return;
      }
      order = await orderService.findOrderByPnrAndEmail(pnr, email as string);
    }

    if (!order) {
      res.status(404).json({
        success: false,
        error: 'order not found'
      });
      return;
    }

    res.json({
      success: true,
      data: {
        orderId: order._id,
        pnr: order.pnr,
        customer: order.customer,
        products: order.products,
        status: order.status,
        createdAt: order.createdAt
      }
    });

  } catch (error) {
    console.error(`[${correlationId}] order retrieval failed:`, error);
    next(error);
  }
};

// activate eSIM (customer action)
export const activateEsim = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const correlationId = req.correlationId || 'unknown';
  
  try {
    const { orderId, productId } = req.body;

    if (!orderId || !productId) {
      res.status(400).json({
        success: false,
        error: 'orderId and productId required'
      });
      return;
    }

    if (!req.user || !req.user.role) {
      res.status(401).json({
        success: false,
        error: 'user authentication required'
      });
      return;
    }

    console.log(`[${correlationId}] activating eSIM: ${orderId}/${productId}`);

    const success = await orderService.activateEsim(orderId, productId, req.user.role);

    if (success) {
      res.json({
        success: true,
        message: 'eSIM activated successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to activate eSIM'
      });
    }

  } catch (error) {
    console.error(`[${correlationId}] eSIM activation failed:`, error);
    
    // send user-friendly error messages
    if (error instanceof Error) {
      if (error.message.includes('already activated')) {
        res.status(400).json({
          success: false,
          error: 'eSIM is already activated',
          user_message: 'Your eSIM is already active and ready to use!'
        });
        return;
      }
      if (error.message.includes('cancelled')) {
        res.status(400).json({
          success: false,
          error: 'Cannot activate cancelled eSIM',
          user_message: 'This eSIM has been cancelled and cannot be activated.'
        });
        return;
      }
    }
    
    next(error);
  }
};

// partner manual status update
export const updateProductStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const correlationId = req.correlationId || 'unknown';
  
  try {
    const { orderId, productId, status } = req.body;

    if (!orderId || !productId || !status) {
      res.status(400).json({
        success: false,
        error: 'orderId, productId, and status required'
      });
      return;
    }

    // only partners can manually update status
    if (!req.user || req.user.role !== 'partner') {
      res.status(403).json({
        success: false,
        error: 'Only partners can manually update product status'
      });
      return;
    }

    console.log(`[${correlationId}] manual status update by partner: ${orderId}/${productId} -> ${status}`);

    const success = await orderService.updateProductStatusManually(orderId, productId, status, req.user.id || req.user.userId);

    if (success) {
      res.json({
        success: true,
        message: `Product status updated to ${status}`
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to update product status'
      });
    }

  } catch (error) {
    console.error(`[${correlationId}] manual status update failed:`, error);
    next(error);
  }
};

// get customer orders for dashboard
export const getCustomerOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const correlationId = req.correlationId || 'unknown';
  
  try {
    // check if user exists and has userId
    if (!req.user || !req.user.userId) {
      console.log(`[${correlationId}] debug: no user or userid in request`);
      res.status(401).json({
        success: false,
        error: 'user authentication required'
      });
      return;
    }

    const customerId = req.user.userId;
    console.log(`[${correlationId}] debug: user from token:`, {
      email: req.user.email,
      role: req.user.role,
      userId: req.user.userId
    });
    console.log(`[${correlationId}] retrieving orders for customer id: ${customerId}`);

    const orders = await orderService.getCustomerOrders(customerId);
    console.log(`[${correlationId}] debug: retrieved ${orders.length} orders`);

    res.json({
      success: true,
      data: {
        orders,
        count: orders.length
      }
    });

  } catch (error) {
    console.error(`[${correlationId}] customer orders retrieval failed:`, error);
    next(error);
  }
};

// cancel order product using command pattern
export const cancelOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const correlationId = req.correlationId || 'unknown';
  
  try {
    const { orderIdentifier, productId, requestSource, reason } = req.body;
    
    console.log(`[${correlationId}] processing airalo cancellation for product ${productId}`);
    
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'user authentication required'
      });
      return;
    }

    // validate order access using service layer
    const order = await orderService.validateOrderAccess(
      orderIdentifier.orderId, 
      req.user, 
      orderIdentifier
    );

    if (!order) {
      console.log(`[${correlationId}] order not found or access denied: ${orderIdentifier.pnr}`);
      res.status(404).json({ 
        success: false, 
        error: 'order not found or access denied' 
      });
      return;
    }

    // get specific product from order
    const product = await orderService.getOrderProduct(order._id.toString(), productId);
    if (!product) {
      console.log(`[${correlationId}] product ${productId} not found in order`);
      res.status(404).json({ 
        success: false, 
        error: 'product not found in order' 
      });
      return;
    }

    // validate cancellation eligibility
    const eligibility = orderService.validateCancellationEligibility(product);
    if (!eligibility.canCancel) {
      // provide user-friendly error messages
      let userMessage = 'This product cannot be cancelled.';
      if (eligibility.reason?.includes('activated')) {
        userMessage = 'Your eSIM has been activated and is in use. Activated eSIMs cannot be refunded.';
      } else if (eligibility.reason?.includes('cancelled')) {
        userMessage = 'This product has already been cancelled.';
      }

      res.status(400).json({
        success: false,
        error: eligibility.reason || 'product cannot be cancelled',
        user_message: userMessage
      });
      return;
    }

    console.log(`[${correlationId}] executing airalo cancellation command`);

    // execute cancellation using command pattern
    const command = new AiraloCancellationCommand(order._id.toString(), productId, reason);
    const result = await commandInvoker.executeCommand(command);

    // prepare response data
    const responseData = {
      success: result.success,
      cancellationId: result.cancellationId,
      refundAmount: result.refundAmount,
      cancellationFee: result.cancellationFee,
      message: result.message,
      processedAt: new Date().toISOString(),
      correlationId
    };

    // send customer notification email
    if (result.success) {
      console.log(`[${correlationId}] sending customer confirmation email`);
      await emailService.sendCancellationConfirmation(
        order.customer.email,
        order.customer.firstName,
        {
          success: true,
          cancellationId: result.cancellationId,
          refundAmount: result.refundAmount,
          message: result.message
        }
      );
    }

    // trigger webhooks for admin notifications
    const webhookEvent = result.success ? 'cancellation.success' : 'cancellation.failed';
    await webhookService.triggerWebhooks(webhookEvent, {
      cancellationId: result.cancellationId,
      orderId: order._id.toString(),
      productId,
      refundAmount: result.refundAmount,
      message: result.message,
      correlationId
    });

    console.log(`[${correlationId}] cancellation completed with status: ${result.success ? 'success' : 'failed'}`);

    res.status(result.success ? 200 : 400).json({
      success: result.success,
      data: responseData
    });

  } catch (error) {
    console.error(`[${correlationId}] cancellation processing error:`, error);
    
    await webhookService.triggerWebhooks('cancellation.error', {
      orderId: req.body.orderIdentifier?.pnr || 'unknown',
      productId: req.body.productId || 'unknown',
      error: error instanceof Error ? error.message : 'unknown error',
      correlationId
    });

    // provide user-friendly error messages
    if (error instanceof Error && error.message.includes('SERVICE_UNAVAILABLE')) {
      res.status(503).json({
        success: false,
        error: 'Service temporarily unavailable',
        user_message: 'Our cancellation service is temporarily unavailable. Please try again in a few minutes.',
        retry_after: 300
      });
      return;
    }

    next(error);
  }
};

// get order statistics for admin dashboard
export const getOrderStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const stats = await orderService.getOrderStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('failed to get order statistics:', error);
    next(error);
  }
};

// get partner statistics for partner dashboard
export const getPartnerStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const stats = await orderService.getPartnerStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('failed to get partner statistics:', error);
    next(error);
  }
};

// health check endpoint to monitor system status and dependencies
export const healthCheck = async (req: Request, res: Response): Promise<void> => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: false,
      email: false,
      orderService: false
    },
    version: '1.0.0'
  };

  try {
    // check order service functionality
    await orderService.getAllOrders(1);
    health.services.orderService = true;
    health.services.database = true;
  } catch (error) {
    console.error('order service health check failed:', error);
    health.status = 'unhealthy';
  }

  try {
    // verify email service configuration
    health.services.email = await emailService.testConnection();
  } catch (error) {
    console.error('email service health check failed:', error);
    health.status = 'unhealthy';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
};

// readiness check to verify system is ready to handle requests
export const readinessCheck = async (req: Request, res: Response): Promise<void> => {
  const readiness = {
    ready: true,
    timestamp: new Date().toISOString(),
    checks: {
      database: false,
      services: false
    }
  };

  try {
    // verify database and service layer readiness
    await orderService.getAllOrders(1);
    readiness.checks.database = true;
    readiness.checks.services = true;
  } catch (error) {
    console.error('readiness check failed:', error);
    readiness.ready = false;
  }

  const statusCode = readiness.ready ? 200 : 503;
  res.status(statusCode).json(readiness);
};