import { CancellationCommand } from './cancellationRequest';
import { OrderRepository } from '../repos/orderRepo';
import { CancellationRepository } from '../repos/cancellationRepo';

interface AiraloApiResponse {
  status: string;
  cancellation_id?: string;
  order_id?: string;
  order_code?: string;
  package_id?: string;
  iccid?: string;
  refund_amount?: number;
  cancellation_fee?: number;
  currency?: string;
  refund_policy?: string;
  estimated_refund_time?: string;
  message: string;
  sim_status?: string;
  error_code?: string;
  policy_reason?: string;
  activated_at?: string;
  retry_after?: number;
}

export class AiraloCancellationCommand extends CancellationCommand {
  private orderRepo: OrderRepository;
  private cancellationRepo: CancellationRepository;

  constructor(orderId: string, productId: string, reason?: string) {
    super(orderId, productId, reason);
    this.orderRepo = new OrderRepository();
    this.cancellationRepo = new CancellationRepository();
  }

  async execute(): Promise<any> {
    try {
      // find the order and product
      const order = await this.orderRepo.findById(this.orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      const product = await this.orderRepo.findProductById(this.orderId, this.productId);
      if (!product) {
        throw new Error('Product not found');
      }

      if (product.provider !== 'airalo') {
        throw new Error('Invalid provider for Airalo cancellation command');
      }

      // create cancellation record
      const cancellation = await this.cancellationRepo.createCancellationRequest({
        orderId: this.orderId,
        productId: this.productId,
        pnr: order.pnr,
        provider: 'airalo',
        requestSource: 'api'
      });

      // calculate refund based on policy and timing
      const refundCalculation = this.calculateRefund(product);
      
      // call Airalo API (mocked)
      const airaloResponse = await this.callAiraloAPI(product, refundCalculation);

      // update cancellation record with vendor response
      const updatedCancellation = await this.cancellationRepo.updateCancellationStatus(
        cancellation._id,
        airaloResponse.status === 'success' ? 'success' : 'failed',
        airaloResponse
      );

      // update product status if successful
      if (airaloResponse.status === 'success') {
        await this.orderRepo.updateProductStatus(this.orderId, this.productId, 'cancelled');
        await this.orderRepo.updateSimStatus(this.orderId, this.productId, 'cancelled');
      }

      return {
        success: airaloResponse.status === 'success',
        cancellationId: cancellation.cancellationId,
        refundAmount: airaloResponse.refund_amount || 0,
        cancellationFee: airaloResponse.cancellation_fee || 0,
        message: airaloResponse.message,
        vendorResponse: airaloResponse
      };

    } catch (error) {
      console.error('Airalo cancellation command failed:', error);
      throw error;
    }
  }

  // calculate refund based on Airalo's specific cancellation policy
  private calculateRefund(product: any): { refundAmount: number; cancellationFee: number; refundPercentage: number } {
    const now = new Date();
    const activationDeadline = new Date(product.activationDeadline);
    const hoursUntilDeadline = (activationDeadline.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    // check if eSIM is already activated using simStatus
    const isActivated = product.simStatus === 'active';
    
    if (isActivated) {
      return { refundAmount: 0, cancellationFee: 0, refundPercentage: 0 };
    }

    // apply cancellation windows based on hours before activation deadline
    for (const window of product.cancellationPolicy.windows) {
      if (hoursUntilDeadline >= (window.hoursBeforeActivation || 0)) {
        const refundPercentage = window.refundPercentage;
        const refundAmount = (product.price.amount * refundPercentage) / 100;
        const cancellationFee = product.price.amount - refundAmount;
        
        return { refundAmount, cancellationFee, refundPercentage };
      }
    }

    // default to no refund if outside all windows
    return { refundAmount: 0, cancellationFee: product.price.amount, refundPercentage: 0 };
  }

  // mock Airalo API call with realistic responses
  private async callAiraloAPI(product: any, refundCalc: any): Promise<AiraloApiResponse> {
    // simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // check if eSIM is activated using simStatus
    const isActivated = product.simStatus === 'active';
    
    if (isActivated) {
      return {
        status: 'error',
        error_code: 'SIM_ALREADY_ACTIVATED',
        order_id: product.metadata.orderId,
        order_code: product.metadata.orderCode,      
        package_id: product.metadata.packageId,       
        iccid: product.metadata.iccid,                
        message: 'eSIM cannot be cancelled - already activated and in use',
        policy_reason: 'Digital products cannot be refunded once activated',
        activated_at: product.activatedAt || new Date().toISOString(),
        sim_status: 'active'
      };
    }

    // simulate random API failures for testing resilience
    if (Math.random() < 0.1) { // 10% chance of failure
      return {
        status: 'error',
        error_code: 'SERVICE_UNAVAILABLE',
        message: 'Vendor service temporarily unavailable',
        retry_after: 900
      };
    }

    // successful cancellation response based on refund percentage
    if (refundCalc.refundPercentage === 100) {
      return {
        status: 'success',
        cancellation_id: `CXL_AL_${Date.now()}`,
        order_id: product.metadata.orderId,
        order_code: product.metadata.orderCode,
        package_id: product.metadata.packageId,
        iccid: product.metadata.iccid,
        refund_amount: refundCalc.refundAmount,
        cancellation_fee: 0,
        currency: product.price.currency,
        refund_policy: 'full_refund_not_activated',
        estimated_refund_time: '1-3 business days',
        message: 'eSIM cancelled successfully - not yet activated',
        sim_status: 'cancelled'
      };
    } else if (refundCalc.refundPercentage === 75) {
      return {
        status: 'success',
        cancellation_id: `CXL_AL_${Date.now()}`,
        order_id: product.metadata.orderId,
        order_code: product.metadata.orderCode,
        package_id: product.metadata.packageId,
        iccid: product.metadata.iccid,
        refund_amount: refundCalc.refundAmount,
        cancellation_fee: refundCalc.cancellationFee,
        currency: product.price.currency,
        refund_policy: '75_percent_refund',
        estimated_refund_time: '1-3 business days',
        message: 'eSIM cancelled with processing fee - not activated',
        sim_status: 'cancelled'
      };
    } else {
      return {
        status: 'error',
        error_code: 'CANCELLATION_WINDOW_EXPIRED',
        order_id: product.metadata.orderId,
        order_code: product.metadata.orderCode,
        package_id: product.metadata.packageId,
        message: 'Cancellation window has expired',
        policy_reason: 'Too close to activation deadline for refund'
      };
    }
  }

  async undo(): Promise<void> {
    // airalo-specific undo logic - restore product status
    try {
      await this.orderRepo.updateProductStatus(this.orderId, this.productId, 'confirmed');
      await this.orderRepo.updateSimStatus(this.orderId, this.productId, 'ready_for_activation');
      console.log(`Airalo cancellation undone for order ${this.orderId}, product ${this.productId}`);
    } catch (error) {
      console.error('Failed to undo Airalo cancellation:', error);
    }
  }
}