import { CancelOrderResponse } from '../types';

export const cancel = async (orderId: string, reason?: string): Promise<CancelOrderResponse> => {
  return {
    orderId,
    cancelledAt: new Date().toISOString(),
    reason: reason || 'no reason provided',
    status: 'cancelled'
  };
};