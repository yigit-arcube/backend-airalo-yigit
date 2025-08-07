import { CancellationCommand } from './cancellationRequest';
import { OrderRepository } from '../repos/orderRepo';
import { CancellationRepository } from '../repos/cancellationRepo';

interface MozioApiResponse {
  status: string;
  cancellation_id?: string;
  booking_id?: string;
  reservation_id?: string;
  refund_amount?: number;
  cancellation_fee?: number;
  currency?: string;
  refund_policy?: string;
  estimated_refund_time?: string;
  message: string;
  error_code?: string;
  retry_after?: number;
}

export class MozioCancellationCommand extends CancellationCommand {
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

      if (product.provider !== 'mozio') {
        throw new Error('Invalid provider for Mozio cancellation command');
      }

      const cancellation = await this.cancellationRepo.createCancellationRequest({
        orderId: this.orderId,
        productId: this.productId,
        pnr: order.pnr,
        provider: 'mozio',
        requestSource: 'api'
      });

      const refundCalculation = this.calculateRefund(product);
      const mozioResponse = await this.callMozioAPI(product, refundCalculation);

      const updatedCancellation = await this.cancellationRepo.updateCancellationStatus(
        cancellation._id,
        mozioResponse.status === 'success' ? 'success' : 'failed',
        mozioResponse
      );

      if (mozioResponse.status === 'success') {
        await this.orderRepo.updateProductStatus(this.orderId, this.productId, 'cancelled');
      }

      return {
        success: mozioResponse.status === 'success',
        cancellationId: cancellation.cancellationId,
        refundAmount: mozioResponse.refund_amount || 0,
        cancellationFee: mozioResponse.cancellation_fee || 0,
        message: mozioResponse.message,
        vendorResponse: mozioResponse
      };

    } catch (error) {
      console.error('Mozio cancellation command failed:', error);
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

  private async callMozioAPI(product: any, refundCalc: any): Promise<MozioApiResponse> {
    await new Promise(resolve => setTimeout(resolve, 1200));

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
        cancellation_id: `CXL_MZ_${Date.now()}`,
        booking_id: product.metadata.bookingReference,
        reservation_id: product.metadata.reservationId,
        refund_amount: refundCalc.refundAmount,
        cancellation_fee: 0,
        currency: product.price.currency,
        refund_policy: 'full_refund',
        estimated_refund_time: '3-5 business days',
        message: 'Transfer cancellation processed successfully'
      };
    } else if (refundCalc.refundPercentage === 75) {
      return {
        status: 'success',
        cancellation_id: `CXL_MZ_${Date.now()}`,
        booking_id: product.metadata.bookingReference,
        reservation_id: product.metadata.reservationId,
        refund_amount: refundCalc.refundAmount,
        cancellation_fee: refundCalc.cancellationFee,
        currency: product.price.currency,
        refund_policy: '75_percent_refund',
        estimated_refund_time: '3-5 business days',
        message: 'Transfer cancelled with processing fee'
      };
    } else {
      return {
        status: 'error',
        error_code: 'CANCELLATION_WINDOW_EXPIRED',
        booking_id: product.metadata.bookingReference,
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
      console.log(`Mozio cancellation undone for order ${this.orderId}, product ${this.productId}`);
    } catch (error) {
      console.error('Failed to undo Mozio cancellation:', error);
    }
  }
}