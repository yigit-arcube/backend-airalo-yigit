import { Router } from 'express';
import { 
  createOrder, 
  getOrder, 
  cancelOrder,
  bulkCancelOrder,
  getOrderStats,
  getPartnerStats,
  getCustomerOrders,
  activateEsim,
  updateProductStatus,
  healthCheck, 
  readinessCheck 
} from '../controllers/orderController';
import { 
  authenticateJWT, 
  authenticateApiKey, 
  authorize, 
  createRateLimit,
  validateCancellationRequest,
  addCorrelationId
} from '../auth/auth';

const router = Router();

// add correlation id to all requests for distributed tracing
router.use(addCorrelationId);

// rate limiting configurations
const orderCreationRateLimit = createRateLimit(60 * 1000, 5); // 5 orders per minute
const cancellationRateLimit = createRateLimit(15 * 1000, 10); // 10 requests per 15 seconds
const generalRateLimit = createRateLimit(60 * 1000, 30); // 30 requests per minute

// authentication middleware based on request headers
const authMiddleware = (req: any, res: any, next: any) => {
  const apiKey = req.headers['x-api-key'];
  const authHeader = req.headers['authorization'];
  
  if (apiKey) {
    // partner api access using api key authentication
    return authenticateApiKey(req, res, next);
  } else if (authHeader) {
    // customer or admin access using jwt token authentication
    return authenticateJWT(req, res, next);
  } else {
    return res.status(401).json({ 
      success: false, 
      error: 'authentication required' 
    });
  }
};

// order creation endpoint for testing cancellation functionality
router.post('/create',
  orderCreationRateLimit,
  authMiddleware,
  authorize(['customer', 'admin']),
  createOrder
);

// get order details by pnr
router.get('/:pnr',
  generalRateLimit,
  authMiddleware,
  authorize(['customer', 'admin', 'partner']),
  getOrder
);

// get customer orders for dashboard
router.get('/customer/my-orders',
  generalRateLimit,
  authenticateJWT,
  authorize(['customer']),
  getCustomerOrders
);

// activate eSIM endpoint (customer action)
router.post('/activate-esim',
  generalRateLimit,
  authenticateJWT,
  authorize(['customer']),
  activateEsim
);

// partner manual product status update
router.post('/partner/update-status',
  generalRateLimit,
  authMiddleware,
  authorize(['partner']),
  updateProductStatus
);

// cancellation endpoint with comprehensive security and validation
router.post('/cancel', 
  cancellationRateLimit,
  authMiddleware,
  authorize(['customer', 'admin', 'partner']),
  validateCancellationRequest,
  cancelOrder
);

//new cncellation endpoint for bulk cancelling
router.post('/bulk-cancel', authMiddleware, authorize(['customer', 'admin', 'partner']), bulkCancelOrder);

// admin dashboard statistics
router.get('/admin/stats',
  generalRateLimit,
  authenticateJWT,
  authorize(['admin']),
  getOrderStats
);

// partner dashboard statistics
router.get('/partner/stats',
  generalRateLimit,
  authMiddleware,
  authorize(['partner']),
  getPartnerStats
);

// health endpoint for monitoring system status
router.get('/health', healthCheck);

// readiness endpoint for kubernetes and load balancer health checks
router.get('/ready', readinessCheck);

export default router;