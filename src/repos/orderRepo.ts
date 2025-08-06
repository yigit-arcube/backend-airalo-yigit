import { BaseRepository } from './baseRepo';
import { Order, IOrder } from '../models/orderModel';

export class OrderRepository extends BaseRepository<IOrder> {
  constructor() {
    super(Order);
  }

  // find order by PNR and customer email for security verification
  async findByPnrAndEmail(pnr: string, email: string): Promise<IOrder | null> {
    return await this.model.findOne({ 
      pnr, 
      'customer.email': email 
    });
  }

  // find specific product within an order
  async findProductById(orderId: string, productId: string): Promise<any | null> {
    const order = await this.model.findById(orderId);
    if (!order) return null;
    
    return order.products.find(product => product.id === productId) || null;
  }

  // update product status within an order
  async updateProductStatus(orderId: string, productId: string, status: string): Promise<IOrder | null> {
    return await this.model.findOneAndUpdate(
      { _id: orderId, 'products.id': productId },
      { $set: { 'products.$.status': status } },
      { new: true }
    );
  }

  // update eSIM status (activate/deactivate)
  async updateSimStatus(orderId: string, productId: string, simStatus: string): Promise<IOrder | null> {
    const updateData: any = { 'products.$.simStatus': simStatus };
    
    // if activating, set activation timestamp
    if (simStatus === 'active') {
      updateData['products.$.activatedAt'] = new Date();
    }

    return await this.model.findOneAndUpdate(
      { _id: orderId, 'products.id': productId },
      { $set: updateData },
      { new: true }
    );
  }

  // find order by PNR only for admin/partner access
  async findByPnr(pnr: string): Promise<IOrder | null> {
    return await this.model.findOne({ pnr });
  }

  // get orders with specific product status for dashboard stats
  async getOrdersByProductStatus(status: string): Promise<IOrder[]> {
    return await this.model.find({ 
      'products.status': status 
    });
  }

  // get orders for specific customer by userId
  async getOrdersByCustomerId(customerId: string): Promise<IOrder[]> {
    return await this.model.find({ 
      customerId: customerId 
    }).sort({ createdAt: -1 });
  }

  // get orders for specific customer by email (keep for backward compatibility)
  async getOrdersByCustomerEmail(email: string): Promise<IOrder[]> {
    return await this.model.find({ 
      'customer.email': email 
    }).sort({ createdAt: -1 });
  }

  // get all orders with pagination for admin dashboard
  async getAllOrdersPaginated(page: number = 1, limit: number = 50): Promise<{ orders: IOrder[], total: number }> {
    const skip = (page - 1) * limit;
    
    const [orders, total] = await Promise.all([
      this.model.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.model.countDocuments()
    ]);

    return { orders, total };
  }

  // get orders by status for filtering
  async getOrdersByStatus(status: string): Promise<IOrder[]> {
    return await this.model.find({ status }).sort({ createdAt: -1 });
  }

  // get detailed stats for partner dashboard
  async getPartnerStats(): Promise<any> {
    const pipeline = [
      { $unwind: '$products' },
      {
        $group: {
          _id: '$products.status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$products.price.amount' }
        }
      }
    ];

    const stats = await this.model.aggregate(pipeline);
    return stats;
  }
}