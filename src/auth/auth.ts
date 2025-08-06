import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { UserRepository } from '../repos/userRepo';

const userRepo = new UserRepository();

// extend Request interface to include user data
declare global {
  namespace Express {
    interface Request {
      user?: any;
      correlationId?: string;
    }
  }
}

// JWT authentication -- verifies customer JWT tokens with email and userid encryption (can be used different variables for jwt, i wanted to use email and userid before encryption)
export const authenticateJWT = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({ success: false, error: 'Access token required' });
      return;
    }

    // Verify JWT token using secret key
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
    
    // Find user by email from token
    const user = await userRepo.findByEmail(decoded.email);
    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid token' });
      return;
    }

    req.user = {
      id: user._id,
      email: user.email,
      role: user.role,
      userId: decoded.userId
    };

    next();
  } catch (error) {
    console.error('JWT authentication failed:', error);
    res.status(403).json({ success: false, error: 'Invalid token' });
  }
};

// API key authentication for partners -- validates partner API keys for B2B access
export const authenticateApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string; // request if being called with api key (http)

    if (!apiKey) {
      res.status(401).json({ success: false, error: 'API key required' });
      return;
    }

    const user = await userRepo.findByApiKey(apiKey);
    if (!user || user.role !== 'partner') {
      res.status(401).json({ success: false, error: 'Invalid API key' });
      return;
    }

    req.user = {
      id: user._id,
      email: user.email,
      role: user.role
    };

    next();
  } catch (error) {
    console.error('API key authentication failed:', error);
    res.status(403).json({ success: false, error: 'Invalid API key' });
  }
};

// role-based authorization -- ensures users can only access appropriate resources, for this case, only cancellation and also purchasing ancillaries.
export const authorize = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

// rate limiting jwt creation-- prevents abuse and retry storms
export const createRateLimit = (windowMs: number, max: number) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: 'Too many requests, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

// Correlation ID -- adds request tracking for distributed tracing (checking who calls)
export const addCorrelationId = (req: Request, res: Response, next: NextFunction): void => {
  const correlationId = req.headers['x-correlation-id'] as string || 
    `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  
  next();
};

// Input validation -- sanitizes and validates request payloads
export const validateCancellationRequest = (req: Request, res: Response, next: NextFunction): void => {
  const { orderIdentifier, productId, requestSource } = req.body;

  // Basic validation for required fields
  if (!orderIdentifier || (!orderIdentifier.pnr && !orderIdentifier.orderId)) {
    res.status(400).json({ 
      success: false, 
      error: 'Order identifier (PNR or orderID) required' 
    });
    return;
  }

  if (!productId) {
    res.status(400).json({ 
      success: false, 
      error: 'Product ID required' 
    });
    return;
  }

  if (!requestSource || !['customer_app', 'admin_panel', 'partner_api'].includes(requestSource)) {
    res.status(400).json({ 
      success: false, 
      error: 'Valid request source required' 
    });
    return;
  }

  // sanitize input data (will do both on frontend and backend)
  req.body.orderIdentifier.pnr = req.body.orderIdentifier.pnr?.trim().toUpperCase();
  req.body.productId = req.body.productId.trim();
  req.body.reason = req.body.reason?.trim();

  next();
};

// error handling with correlation ID logging -- ensures errors are properly tracked
export const errorHandler = (error: Error, req: Request, res: Response, next: NextFunction): void => {
  const correlationId = req.correlationId || 'unknown';
  
  console.error(`[${correlationId}] Error:`, error.message);
  console.error(`[${correlationId}] Stack:`, error.stack);

  // don't expose internal error details in production(not important)
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    correlationId,
    ...(isDevelopment && { details: error.message })
  });
};

// security headers -- adds essential security headers(these are mock headers, not really put a lot effort into it.)
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  next();
};