import { NextFunction, Request, Response } from 'express';
import * as orderService from '../services/orderService';
import { ApiResponse, CancelOrderRequest, CancelOrderResponse } from '../types';

export const cancelOrder = async (
  req: Request<{}, ApiResponse<CancelOrderResponse>, CancelOrderRequest>,
  res: Response<ApiResponse<CancelOrderResponse>>,
  next: NextFunction
): Promise<void> => {
  try {
    const { orderId, reason } = req.body;
    
    if (!orderId) {
      res.status(400).json({ 
        success: false, 
        error: 'orderId required' 
      });
      return;
    }

    const result = await orderService.cancel(orderId, reason);
    res.json({ 
      success: true, 
      data: result 
    });
  } catch (e) {
    next(e);
  }
};