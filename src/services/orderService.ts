import { OrderRepository } from '../repos/orderRepo';
import { IOrder, IProduct } from '../models/orderModel';
import { EncryptionService } from './encryptionService';
import { WebhookService } from './webhookService';

export class OrderService {
  private orderRepo: OrderRepository;
  private encryptionService: EncryptionService;
  private webhookService: WebhookService;// new webhook support

  constructor() {
    this.orderRepo = new OrderRepository();
    this.encryptionService = new EncryptionService();
    this.webhookService = new WebhookService();
  }

  // create new order with airalo products for testing cancellation
  async createOrder(orderData: {
    customer: {
      email: string;
      firstName: string;
      lastName: string;
    };
    products: Array<{
      title: string;
      type: string;
      provider?: string;
      price: { amount: number; currency: string };
      metadata?: any;
    }>;
  }, customerId: string): Promise<IOrder> {
    try {
      const pnr = this.generatePNR();
      const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // create products with provider-specific logic, either airalo, dragonpass or mozio
  const products: IProduct[] = orderData.products.map((product, index) => {
    const baseProduct = {
      id: `PROD-${String(index + 1).padStart(3, '0')}`,
      title: product.title,
      provider: product.provider || 'unknown',
      type: product.type,
      price: product.price,
      status: 'pending' as const,
      cancellationPolicy: {
        windows: [
          {
            hoursBeforeActivation: 72,
            refundPercentage: 100,
            description: 'full refund - service not yet activated'
          },
          {
            hoursBeforeActivation: 24,
            refundPercentage: 75,
            description: '75% refund (25% processing fee)'
          },
          {
            hoursBeforeActivation: 0,
            refundPercentage: 0,
            description: 'no refund - service activated or activation deadline passed'
          }
        ],
        canCancel: true,
        cancelCondition: 'only_if_not_activated'
      },
      serviceDateTime: new Date(),
      activationDeadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    };

    // Provider-specific product creation
    if (product.provider === 'airalo' && product.type === 'esim') {
      return {
        ...baseProduct,
        simStatus: 'ready_for_activation' as const,
        metadata: {
          orderId: `${Math.floor(Math.random() * 900000) + 100000}`,
          orderCode: `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 900000) + 100000}`,
          packageId: 'usa-30days-5gb',
          iccid: `${Math.floor(Math.random() * 9000000000000000) + 1000000000000000}`,
          qrCode: `LPA:1$lpa.airalo.com$TEST${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          country: 'united states',
          countryCode: 'us',
          dataAmount: '5 gb',
          validityDays: 30,
          activationDeadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          isActivated: false,
          activatedAt: null,

          ...product.metadata
        }
      };
    } else if (product.provider === 'mozio' && product.type === 'airport_transfer') {
      return {
        ...baseProduct,
        transferStatus: 'confirmed' as const, 
        metadata: {
          bookingReference: `MZ${Date.now()}${Math.floor(Math.random() * 1000)}`,
          pickupLocation: 'Airport Terminal',
          dropoffLocation: 'City Center',
          vehicleType: 'Premium Sedan',
          driverAssigned: false,
          estimatedPickupTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          contactNumber: '+1-800-MOZIO-1',
          specialInstructions: '',
          ...product.metadata
        }
      };
    } else if (product.provider === 'dragonpass' && product.type === 'lounge_access') {
      return {
        ...baseProduct,
        accessStatus: 'confirmed' as const, 
        metadata: {
          accessCode: `DP${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
          loungeLocation: 'Terminal Area',
          validFrom: new Date().toISOString(),
          validUntil: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
          maxGuests: 1,
          amenitiesIncluded: ['WiFi', 'Food & Beverages', 'Comfortable Seating'],
          qrCodeAccess: `https://dragonpass.com/access/${Math.random().toString(36).substr(2, 10)}`,
          ...product.metadata
        }
      };
    } else {
      // Default case for unknown providers or types - no special status fields
      return {
        ...baseProduct,
        metadata: {
          serviceReference: `REF${Date.now()}${Math.floor(Math.random() * 1000)}`,
          ...product.metadata
        }
      };
    }
  });

        console.log(`creating order for customer id: ${customerId}, email: ${orderData.customer.email}`);
        console.log('products being created:', products.map(p => ({ id: p.id, provider: p.provider, type: p.type })));
        
        const newOrder = await this.orderRepo.create({
          pnr,
          transactionId,
          customerId, // store the userId
          customer: orderData.customer,
          products,
          status: 'confirmed'
        });

        // Start automatic status update timer for each product
        products.forEach((product, index) => {
          this.startAutomaticStatusTimer(newOrder._id.toString(), product.id);
        });

        console.log(`order created: ${pnr} for customer id: ${customerId}`);
        return newOrder;
      } catch (error) {
        console.error('order creation failed:', error);
        throw new Error('failed to create order');
      }
    }

    // automatic status update timer (15 seconds with randomized outcomes)
    private startAutomaticStatusTimer(orderId: string, productId: string): void {
      setTimeout(async () => {
        try {
          const currentProduct = await this.orderRepo.findProductById(orderId, productId);
          if (!currentProduct || currentProduct.status !== 'pending') {
            return;
          }
    
          const randomValue = Math.random();
          let newStatus: string;
    
          if (randomValue < 0.7) {// these are different cases to test the function in the cases it fails
            newStatus = 'success';
          } else if (randomValue < 0.85) {
            newStatus = 'failed';
          } else {
            newStatus = 'denied';
          }
    
          await this.orderRepo.updateProductStatus(orderId, productId, newStatus);
          console.log(`automatic status update: order ${orderId}, product ${productId} -> ${newStatus}`);
    
          //webhook creation for failed and denied orders
          if (newStatus === 'failed' || newStatus === 'denied') {
            await this.webhookService.triggerWebhooks('order.failed', {
              orderId,
              productId,
              status: newStatus,
              reason: newStatus === 'failed' ? 'Payment processing failed' : 'Order rejected by provider',
              timestamp: new Date().toISOString()
            });
          }

        }catch (error) {
          console.error('automatic status update failed:', error);
        }
      }, 15000);
    }
    // activate eSIM (customer action)
    async activateEsim(orderId: string, productId: string, userRole: string): Promise<boolean> {
      try {
        const product = await this.orderRepo.findProductById(orderId, productId);
        if (!product) {
          throw new Error('Product not found');
        }

        if (product.simStatus === 'active') {
          throw new Error('eSIM already activated');
        }

        if (product.simStatus === 'cancelled') {
          throw new Error('Cannot activate cancelled eSIM');
        }

        // update simStatus to active with timestamp
        const updatedOrder = await this.orderRepo.updateSimStatus(orderId, productId, 'active');
        
        if (updatedOrder) {
          console.log(`eSIM activated: order ${orderId}, product ${productId}`);
          return true;
        }
        return false;

      } catch (error) {
        console.error('eSIM activation failed:', error);
        throw error;
      }
    }

  // partner manual status change
  async updateProductStatusManually(orderId: string, productId: string, newStatus: string, partnerId: string): Promise<boolean> {
    try {
      const validStatuses = ['pending', 'success', 'failed', 'denied', 'cancelled'];
      if (!validStatuses.includes(newStatus)) {
        throw new Error('Invalid status');
      }

      const updatedOrder = await this.orderRepo.updateProductStatus(orderId, productId, newStatus);
      
      if (updatedOrder) {
        console.log(`manual status update by partner ${partnerId}: order ${orderId}, product ${productId} -> ${newStatus}`);
        return true;
      }
      return false;

    } catch (error) {
      console.error('manual status update failed:', error);
      throw error;
    }
  }

  // find order by pnr for admin access
  async findOrderByPnr(pnr: string): Promise<IOrder | null> {
    try {
      return await this.orderRepo.findByPnr(pnr);
    } catch (error) {
      console.error('failed to find order by pnr:', error);
      return null;
    }
  }

  // find order with customer email verification for security
  async findOrderByPnrAndEmail(pnr: string, email: string): Promise<IOrder | null> {
    try {
      return await this.orderRepo.findByPnrAndEmail(pnr, email);
    } catch (error) {
      console.error('failed to find order by pnr and email:', error);
      return null;
    }
  }

  // validate user access to order based on role and ownership
  async validateOrderAccess(orderId: string, user: any, orderIdentifier: any): Promise<IOrder | null> {
    try {
      let order: IOrder | null = null;

      if (user.role === 'admin' || user.role === 'partner') {
        order = await this.orderRepo.findByPnr(orderIdentifier.pnr);
      } else if (user.role === 'customer') {
        if (!orderIdentifier.email) {
          throw new Error('customer email required for verification');
        }
        order = await this.orderRepo.findByPnrAndEmail(orderIdentifier.pnr, orderIdentifier.email);
      }

      return order;
    } catch (error) {
      console.error('order access validation failed:', error);
      throw error;
    }
  }

  // get specific product from order for cancellation processing
  async getOrderProduct(orderId: string, productId: string): Promise<any> {
    try {
      return await this.orderRepo.findProductById(orderId, productId);
    } catch (error) {
      console.error('failed to get order product:', error);
      return null;
    }
  }

  // get customer orders for dashboard - now uses customerId
  async getCustomerOrders(customerId: string): Promise<IOrder[]> {
    try {
      console.log(`debug: getting orders for customer id: ${customerId}`);
      const orders = await this.orderRepo.getOrdersByCustomerId(customerId);
      console.log(`debug: found ${orders.length} orders for customer`);
      
      if (orders && orders.length > 0) {
        const firstOrder = orders[0];
        if (firstOrder) {
          console.log('debug: first order pnr:', firstOrder.pnr);
          console.log('debug: first order products count:', firstOrder.products ? firstOrder.products.length : 0);
        }
      }
      
      return orders || [];
    } catch (error) {
      console.error('failed to get customer orders:', error);
      return [];
    }
  }

  // get all orders for admin dashboard with pagination
  async getAllOrders(page: number = 1, limit: number = 50): Promise<{ orders: IOrder[], total: number }> {
    try {
      return await this.orderRepo.getAllOrdersPaginated(page, limit);
    } catch (error) {
      console.error('failed to get all orders:', error);
      return { orders: [], total: 0 };
    }
  }

  // validate if product can be cancelled based on policy and simStatus
validateCancellationEligibility(product: any): { canCancel: boolean; reason?: string } {
  try {
    if (product.status === 'cancelled') {
      return { canCancel: false, reason: 'product already cancelled' };
    }

    if (product.status === 'failed' || product.status === 'denied') {
      return { canCancel: false, reason: 'product already failed/denied - no refund available' };
    }

    if (!product.cancellationPolicy?.canCancel) {
      return { canCancel: false, reason: 'product not eligible for cancellation per policy' };
    }

    switch (product.provider) {
      case 'airalo':
        if (product.simStatus === 'active') {
          return { canCancel: false, reason: 'eSIM already activated and in use' };
        }
        break;
        
      case 'mozio':
        if (product.transferStatus === 'in_progress' || product.transferStatus === 'completed') {
          return { canCancel: false, reason: 'transfer already in progress or completed' };
        }
        break;
        
      case 'dragonpass':
        if (product.accessStatus === 'used' || product.accessStatus === 'expired') {
          return { canCancel: false, reason: 'lounge access already used or expired' };
        }
        break;
        
      default:
        console.log(`Warning: Unknown provider ${product.provider}, using generic validation`);
        break;
    }

    if (product.cancellationPolicy.cancelCondition === 'only_if_not_activated') {
      const now = new Date();
      const serviceDate = new Date(product.serviceDateTime);
      const hoursSinceService = (now.getTime() - serviceDate.getTime()) / (1000 * 60 * 60);
      
      const sortedWindows = product.cancellationPolicy.windows.sort((a: any, b: any) => 
        (a.hoursBeforeActivation || 0) - (b.hoursBeforeActivation || 0)
      );
      
      let applicableWindow: any = null;
      for (const window of sortedWindows) {
        const windowHours = window.hoursBeforeActivation || 0;
        if (hoursSinceService <= windowHours) {
          applicableWindow = window;
          break;
        }
      }
      
      if (!applicableWindow || applicableWindow.refundPercentage === 0) {
        return { canCancel: false, reason: 'cancellation window has expired' };
      }
    }

    return { canCancel: true };
  } catch (error) {
    console.error('cancellation eligibility validation failed:', error);
    return { canCancel: false, reason: 'validation error' };
  }
}

  // generate unique pnr for new orders
  private generatePNR(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let pnr = '';
    for (let i = 0; i < 6; i++) {
      pnr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pnr;
  }

  // get order statistics for admin dashboard
  async getOrderStats(): Promise<any> {
    try {
      const { orders } = await this.orderRepo.getAllOrdersPaginated(1, 1000); // get all for stats
      
      const stats = {
        totalOrders: orders.length,
        confirmedOrders: orders.filter(o => o.status === 'confirmed').length,
        totalProducts: orders.reduce((sum, order) => sum + order.products.length, 0),
        pendingProducts: orders.reduce((sum, order) => 
          sum + order.products.filter(p => p.status === 'pending').length, 0),
        successProducts: orders.reduce((sum, order) => 
          sum + order.products.filter(p => p.status === 'success').length, 0),
        failedProducts: orders.reduce((sum, order) => 
          sum + order.products.filter(p => p.status === 'failed').length, 0),
        deniedProducts: orders.reduce((sum, order) => 
          sum + order.products.filter(p => p.status === 'denied').length, 0),
        cancelledProducts: orders.reduce((sum, order) => 
          sum + order.products.filter(p => p.status === 'cancelled').length, 0),
        activatedEsims: orders.reduce((sum, order) => 
        //   sum + order.products.filter(p => p.simStatus === 'active').length, 0),
        // totalRevenue: orders.reduce((sum, order) => 
          sum + order.products.reduce((productSum, product) => 
            productSum + (product.status === 'success' ? product.price.amount : 0), 0), 0)
      };

      return stats;
    } catch (error) {
      console.error('failed to get order statistics:', error);
      return {
        totalOrders: 0,
        confirmedOrders: 0,
        totalProducts: 0,
        pendingProducts: 0,
        successProducts: 0,
        failedProducts: 0,
        deniedProducts: 0,
        cancelledProducts: 0,
        activatedEsims: 0,
        totalRevenue: 0
      };
    }
  }

  // get partner dashboard statistics
  async getPartnerStats(): Promise<any> {
    try {
      const stats = await this.orderRepo.getPartnerStats();
      return stats;
    } catch (error) {
      console.error('failed to get partner statistics:', error);
      return [];
    }
  }
}