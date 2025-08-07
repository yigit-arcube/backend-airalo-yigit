import { CancellationCommand } from './cancellationRequest';
import { OrderRepository } from '../repos/orderRepo';
import { CancellationRepository } from '../repos/cancellationRepo';

interface DragonPassApiResponse {
  status: string;
  cancellation_id?: string;
  booking_id?: string;
  lounge_id?: string;
  refund_amount?: number;
  cancellation_fee?: number;
  currency?: string;
  refund_policy?: string;
  estimated_refund_time?: string;
  message: string;
  error_code?: string;
  retry_after?: number;
}

export class DragonPassCancellationCommand extends CancellationCommand {
  private orderRepo: OrderRepository;
  private cancellationRepo: CancellationRepository;

  constructor(orderId: string, productId: string, reason?: string) {
    super(orderId, productId, reason);
    this.orderRepo = new OrderRepository();
    this.cancellationRepo = new CancellationRepository();
  }

  async execute(): Promise<any> {
    try {
      const order = await this.orderRepo.findById(this.orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      const product = await this.orderRepo.findProductById(this.orderId, this.productId);
      if (!product) {
        throw new Error('Product not found');
      }

      if (product.provider !== 'dragonpass') {
        throw new Error('Invalid provider for DragonPass cancellation command');
      }

      const cancellation = await this.cancellationRepo.createCancellationRequest({
        orderId: this.orderId,
        productId: this.productId,
        pnr: order.pnr,
        provider: 'dragonpass',
        requestSource: 'api'
      });

      const refundCalculation = this.calculateRefund(product);
      const dragonPassResponse = await this.callDragonPassAPI(product, refundCalculation);

      const updatedCancellation = await this.cancellationRepo.updateCancellationStatus(
        cancellation._id,
        dragonPassResponse.status === 'success' ? 'success' : 'failed',
        dragonPassResponse
      );

      if (dragonPassResponse.status === 'success') {
        await this.orderRepo.updateProductStatus(this.orderId, this.productId, 'cancelled');
      }

      return {
        success: dragonPassResponse.status === 'success',
        cancellationId: cancellation.cancellationId,
        refundAmount: dragonPassResponse.refund_amount || 0,
        cancellationFee: dragonPassResponse.cancellation_fee || 0,
        message: dragonPassResponse.message,
        vendorResponse: dragonPassResponse
      };

    } catch (error) {
      console.error('DragonPass cancellation command failed:', error);
      throw error;
    }
  }

  private calculateRefund(product: any): { refundAmount: number; cancellationFee: number; refundPercentage: number } {
    const now = new Date();
    const serviceDate = new Date(product.serviceDateTime);
    const hoursAfterService = (now.getTime() - serviceDate.getTime()) / (1000 * 60 * 60);

    for (const window of product.cancellationPolicy.windows) {
      if (hoursAfterService <= (window.hoursBeforeActivation || 0)) {
        const refundPercentage = window.refundPercentage;
        const refundAmount = (product.price.amount * refundPercentage) / 100;
        const cancellationFee = product.price.amount - refundAmount;
        
        return { refundAmount, cancellationFee, refundPercentage };
      }
    }

    return { refundAmount: 0, cancellationFee: product.price.amount, refundPercentage: 0 };
  }

  private async callDragonPassAPI(product: any, refundCalc: any): Promise<DragonPassApiResponse> {
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (Math.random() < 0.1) {
      return {
        status: 'error',
        error_code: 'SERVICE_UNAVAILABLE',
        message: 'Vendor service temporarily unavailable',
        retry_after: 900
      };
    }

    if (refundCalc.refundPercentage === 100) {
      return {
        status: 'success',
        cancellation_id: `CXL_DP_${Date.now()}`,
        booking_id: product.metadata.accessCode,
        lounge_id: product.metadata.loungeId,
        refund_amount: refundCalc.refundAmount,
        cancellation_fee: 0,
        currency: product.price.currency,
        refund_policy: 'full_refund',
        estimated_refund_time: '5-7 business days',
        message: 'Lounge access cancelled successfully'
      };
    } else if (refundCalc.refundPercentage === 75) {
      return {
        status: 'success',
        cancellation_id: `CXL_DP_${Date.now()}`,
        booking_id: product.metadata.accessCode,
        lounge_id: product.metadata.loungeId,
        refund_amount: refundCalc.refundAmount,
        cancellation_fee: refundCalc.cancellationFee,
        currency: product.price.currency,
        refund_policy: '75_percent_refund',
        estimated_refund_time: '5-7 business days',
        message: 'Lounge access cancelled with processing fee'
      };
    } else {
      return {
        status: 'error',
        error_code: 'CANCELLATION_WINDOW_EXPIRED',
        booking_id: product.metadata.accessCode,
        message: 'Cancellation window has expired',
        refund_amount: 0,
        cancellation_fee: product.price.amount,
        currency: product.price.currency
      };
    }
  }

  async undo(): Promise<void> {
    try {
      await this.orderRepo.updateProductStatus(this.orderId, this.productId, 'confirmed');
      console.log(`DragonPass cancellation undone for order ${this.orderId}, product ${this.productId}`);
    } catch (error) {
      console.error('Failed to undo DragonPass cancellation:', error);
    }
  }
}