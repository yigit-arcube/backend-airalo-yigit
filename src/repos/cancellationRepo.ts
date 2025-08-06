import { BaseRepository } from './baseRepo';
import { Cancellation, ICancellation } from '../models/cancellationModel';

export class CancellationRepository extends BaseRepository<ICancellation> {
  constructor() {
    super(Cancellation);
  }

  // create a new cancellation request with unique ID generation
  async createCancellationRequest(data: any): Promise<ICancellation> {
    const cancellationId = `CXL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return await this.create({
      ...data,
      cancellationId
    });
  }

  // update cancellation status after vendor response
  async updateCancellationStatus(id: string, status: string, vendorResponse: any): Promise<ICancellation | null> {
    return await this.update(id, {
      status,
      vendorResponse,
      processedAt: new Date()
    });
  }

  // find pending cancellations for retry mechanism
  async findPendingCancellations(): Promise<ICancellation[]> {
    return await this.model.find({ 
      status: 'pending',
      createdAt: { 
        $lt: new Date(Date.now() - 5 * 60 * 1000) // Older than 5 minutes
      }
    });
  }

  // find cancellations by order ID for audit purposes
  async findByOrderId(orderId: string): Promise<ICancellation[]> {
    return await this.model.find({ orderId });
  }
}