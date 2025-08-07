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


}