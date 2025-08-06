import { Document, Model } from 'mongoose';

export abstract class BaseRepository<T extends Document> {
  protected model: Model<T>;

  constructor(model: Model<T>) {
    this.model = model;
  }

  async findById(id: string): Promise<T | null> {
    return await this.model.findById(id);
  }

  async create(data: any): Promise<T> {
    return await this.model.create(data);
  }

  async update(id: string, data: any): Promise<T | null> {
    return await this.model.findByIdAndUpdate(id, data, { new: true });
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.model.findByIdAndDelete(id);
    return !!result;
  }

  async findAll(): Promise<T[]> {
    return await this.model.find();
  }
}