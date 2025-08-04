export interface CancelOrderRequest {
  orderId: string;
  reason?: string;
}

export interface CancelOrderResponse {
  orderId: string;
  cancelledAt: string;
  reason: string;
  status: 'cancelled';
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}