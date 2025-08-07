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
  //validateCancellationEligibility(product: any): { canCancel: boolean; reason?: string } we are using this same function at orderController.ts

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
    const { orders } = await this.orderRepo.getAllOrdersPaginated(1, 1000);
    
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
        sum + order.products.filter(p => p.simStatus === 'active').length, 0),
      confirmedTransfers: orders.reduce((sum, order) => 
        sum + order.products.filter(p => p.transferStatus === 'confirmed').length, 0),
      completedTransfers: orders.reduce((sum, order) => 
        sum + order.products.filter(p => p.transferStatus === 'completed').length, 0),
      inProgressTransfers: orders.reduce((sum, order) => 
        sum + order.products.filter(p => p.transferStatus === 'in_progress').length, 0),
      confirmedAccess: orders.reduce((sum, order) => 
        sum + order.products.filter(p => p.accessStatus === 'confirmed').length, 0),
      usedAccess: orders.reduce((sum, order) => 
        sum + order.products.filter(p => p.accessStatus === 'used').length, 0),
      expiredAccess: orders.reduce((sum, order) => 
        sum + order.products.filter(p => p.accessStatus === 'expired').length, 0),
      totalRevenue: orders.reduce((sum, order) => 
        sum + order.products.reduce((productSum, product) => 
          productSum + (product.status === 'success' ? product.price.amount : 0), 0), 0),
      providerStats: {
        airalo: {
          totalProducts: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'airalo').length, 0),
          successfulProducts: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'airalo' && p.status === 'success').length, 0),
          activatedEsims: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'airalo' && p.simStatus === 'active').length, 0),
          revenue: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'airalo' && p.status === 'success')
              .reduce((providerSum, product) => providerSum + product.price.amount, 0), 0)
        },
        mozio: {
          totalProducts: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'mozio').length, 0),
          successfulProducts: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'mozio' && p.status === 'success').length, 0),
          confirmedTransfers: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'mozio' && p.transferStatus === 'confirmed').length, 0),
          completedTransfers: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'mozio' && p.transferStatus === 'completed').length, 0),
          revenue: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'mozio' && p.status === 'success')
              .reduce((providerSum, product) => providerSum + product.price.amount, 0), 0)
        },
        dragonpass: {
          totalProducts: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'dragonpass').length, 0),
          successfulProducts: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'dragonpass' && p.status === 'success').length, 0),
          confirmedAccess: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'dragonpass' && p.accessStatus === 'confirmed').length, 0),
          usedAccess: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'dragonpass' && p.accessStatus === 'used').length, 0),
          revenue: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'dragonpass' && p.status === 'success')
              .reduce((providerSum, product) => providerSum + product.price.amount, 0), 0)
        }
      },
      recentActivity: {
        last24Hours: {
          newOrders: orders.filter(o => {
            const orderDate = new Date(o.createdAt);
            const now = new Date();
            const timeDiff = (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60);
            return timeDiff <= 24;
          }).length,
          activations: orders.reduce((sum, order) => {
            const recentActivations = order.products.filter(p => {
              if (!p.activatedAt) return false;
              const activationDate = new Date(p.activatedAt);
              const now = new Date();
              const timeDiff = (now.getTime() - activationDate.getTime()) / (1000 * 60 * 60);
              return timeDiff <= 24;
            });
            return sum + recentActivations.length;
          }, 0),
          cancellations: orders.reduce((sum, order) => {
            const recentCancellations = order.products.filter(p => {
              if (p.status !== 'cancelled') return false;
              const orderDate = new Date(order.createdAt);
              const now = new Date();
              const timeDiff = (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60);
              return timeDiff <= 24;
            });
            return sum + recentCancellations.length;
          }, 0)
        }
      }
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
      confirmedTransfers: 0,
      completedTransfers: 0,
      inProgressTransfers: 0,
      confirmedAccess: 0,
      usedAccess: 0,
      expiredAccess: 0,
      totalRevenue: 0,
      providerStats: {
        airalo: { totalProducts: 0, successfulProducts: 0, activatedEsims: 0, revenue: 0 },
        mozio: { totalProducts: 0, successfulProducts: 0, confirmedTransfers: 0, completedTransfers: 0, revenue: 0 },
        dragonpass: { totalProducts: 0, successfulProducts: 0, confirmedAccess: 0, usedAccess: 0, revenue: 0 }
      },
      recentActivity: {
        last24Hours: { newOrders: 0, activations: 0, cancellations: 0 }
      }
    };
  }
}

async getPartnerStats(): Promise<any> {
  try {
    const { orders } = await this.orderRepo.getAllOrdersPaginated(1, 1000);
    
    const partnerStats = [
      {
        _id: 'pending',
        count: orders.reduce((sum, order) => 
          sum + order.products.filter(p => p.status === 'pending').length, 0),
        totalAmount: orders.reduce((sum, order) => 
          sum + order.products.filter(p => p.status === 'pending')
            .reduce((statusSum, product) => statusSum + product.price.amount, 0), 0)
      },
      {
        _id: 'success',
        count: orders.reduce((sum, order) => 
          sum + order.products.filter(p => p.status === 'success').length, 0),
        totalAmount: orders.reduce((sum, order) => 
          sum + order.products.filter(p => p.status === 'success')
            .reduce((statusSum, product) => statusSum + product.price.amount, 0), 0)
      },
      {
        _id: 'failed',
        count: orders.reduce((sum, order) => 
          sum + order.products.filter(p => p.status === 'failed').length, 0),
        totalAmount: orders.reduce((sum, order) => 
          sum + order.products.filter(p => p.status === 'failed')
            .reduce((statusSum, product) => statusSum + product.price.amount, 0), 0)
      },
      {
        _id: 'denied',
        count: orders.reduce((sum, order) => 
          sum + order.products.filter(p => p.status === 'denied').length, 0),
        totalAmount: orders.reduce((sum, order) => 
          sum + order.products.filter(p => p.status === 'denied')
            .reduce((statusSum, product) => statusSum + product.price.amount, 0), 0)
      },
      {
        _id: 'cancelled',
        count: orders.reduce((sum, order) => 
          sum + order.products.filter(p => p.status === 'cancelled').length, 0),
        totalAmount: orders.reduce((sum, order) => 
          sum + order.products.filter(p => p.status === 'cancelled')
            .reduce((statusSum, product) => statusSum + product.price.amount, 0), 0)
      }
    ];

    const providerBreakdown = {
      airalo: {
        totalProducts: orders.reduce((sum, order) => 
          sum + order.products.filter(p => p.provider === 'airalo').length, 0),
        statusBreakdown: {
          pending: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'airalo' && p.status === 'pending').length, 0),
          success: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'airalo' && p.status === 'success').length, 0),
          failed: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'airalo' && p.status === 'failed').length, 0),
          denied: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'airalo' && p.status === 'denied').length, 0),
          cancelled: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'airalo' && p.status === 'cancelled').length, 0)
        },
        simStatusBreakdown: {
          ready: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'airalo' && p.simStatus === 'ready_for_activation').length, 0),
          active: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'airalo' && p.simStatus === 'active').length, 0),
          cancelled: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'airalo' && p.simStatus === 'cancelled').length, 0)
        }
      },
      mozio: {
        totalProducts: orders.reduce((sum, order) => 
          sum + order.products.filter(p => p.provider === 'mozio').length, 0),
        statusBreakdown: {
          pending: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'mozio' && p.status === 'pending').length, 0),
          success: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'mozio' && p.status === 'success').length, 0),
          failed: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'mozio' && p.status === 'failed').length, 0),
          denied: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'mozio' && p.status === 'denied').length, 0),
          cancelled: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'mozio' && p.status === 'cancelled').length, 0)
        },
        transferStatusBreakdown: {
          confirmed: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'mozio' && p.transferStatus === 'confirmed').length, 0),
          inProgress: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'mozio' && p.transferStatus === 'in_progress').length, 0),
          completed: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'mozio' && p.transferStatus === 'completed').length, 0),
          cancelled: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'mozio' && p.transferStatus === 'cancelled').length, 0)
        }
      },
      dragonpass: {
        totalProducts: orders.reduce((sum, order) => 
          sum + order.products.filter(p => p.provider === 'dragonpass').length, 0),
        statusBreakdown: {
          pending: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'dragonpass' && p.status === 'pending').length, 0),
          success: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'dragonpass' && p.status === 'success').length, 0),
          failed: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'dragonpass' && p.status === 'failed').length, 0),
          denied: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'dragonpass' && p.status === 'denied').length, 0),
          cancelled: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'dragonpass' && p.status === 'cancelled').length, 0)
        },
        accessStatusBreakdown: {
          confirmed: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'dragonpass' && p.accessStatus === 'confirmed').length, 0),
          used: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'dragonpass' && p.accessStatus === 'used').length, 0),
          expired: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'dragonpass' && p.accessStatus === 'expired').length, 0),
          cancelled: orders.reduce((sum, order) => 
            sum + order.products.filter(p => p.provider === 'dragonpass' && p.accessStatus === 'cancelled').length, 0)
        }
      }
    };

    return {
      statusStats: partnerStats,
      providerBreakdown: providerBreakdown,
      totalOrders: orders.length,
      totalProducts: orders.reduce((sum, order) => sum + order.products.length, 0),
      totalRevenue: orders.reduce((sum, order) => 
        sum + order.products.reduce((productSum, product) => 
          productSum + (product.status === 'success' ? product.price.amount : 0), 0), 0)
    };
  } catch (error) {
    console.error('failed to get partner statistics:', error);
    return {
      statusStats: [],
      providerBreakdown: {
        airalo: { totalProducts: 0, statusBreakdown: {}, simStatusBreakdown: {} },
        mozio: { totalProducts: 0, statusBreakdown: {}, transferStatusBreakdown: {} },
        dragonpass: { totalProducts: 0, statusBreakdown: {}, accessStatusBreakdown: {} }
      },
      totalOrders: 0,
      totalProducts: 0,
      totalRevenue: 0
    };
  }
}
}
