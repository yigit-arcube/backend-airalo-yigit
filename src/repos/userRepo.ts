import { BaseRepository } from './baseRepo';
import { User, IUser } from '../models/userModel';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

// invitation code interface for partner registration
interface IInvitationCode {
  _id?: string;
  invitationCode: string;
  createdBy: string;
  isUsed: boolean;
  usedBy?: string;
  createdAt: Date;
  usedAt?: Date;
}

// invitation codes collection schema
const InvitationCodeSchema = new mongoose.Schema<IInvitationCode>({
  invitationCode: { type: String, required: true, unique: true },
  createdBy: { type: String, required: true },
  isUsed: { type: Boolean, default: false },
  usedBy: { type: String },
  createdAt: { type: Date, default: Date.now },
  usedAt: { type: Date }
});

const InvitationCode = mongoose.model<IInvitationCode>('InvitationCode', InvitationCodeSchema);

export class UserRepository extends BaseRepository<IUser> {
  constructor() {
    super(User);
  }

  // find user by email for authentication
  async findByEmail(email: string): Promise<IUser | null> {
    return await this.model.findOne({ email, isActive: true });
  }

  // find user by API key for partner authentication
  async findByApiKey(apiKey: string): Promise<IUser | null> {
    return await this.model.findOne({ apiKey, isActive: true });
  }

  // create user with hashed password
  async createUser(userData: any): Promise<IUser> {
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    return await this.create({
      ...userData,
      password: hashedPassword
    });
  }

  // validate user password (hashed)
  async validatePassword(user: IUser, password: string): Promise<boolean> {
    return await bcrypt.compare(password, user.password);
  }

  // create invitation code for partner registration
  async createInvitationCode(invitationData: any): Promise<any> {
    return await InvitationCode.create(invitationData);
  }

  // find invitation code for validation
  async findInvitationCode(invitationCode: string): Promise<any> {
    return await InvitationCode.findOne({ invitationCode });
  }

  // mark invitation code as used
  async markInvitationAsUsed(invitationCode: string, usedBy: string): Promise<boolean> {
    const result = await InvitationCode.findOneAndUpdate(
      { invitationCode, isUsed: false },
      { 
        isUsed: true, 
        usedBy, 
        usedAt: new Date() 
      }
    );
    return !!result;
  }

  // get invitation codes created by admin
  async getInvitationsByAdmin(adminId: string): Promise<any[]> {
    return await InvitationCode.find({ createdBy: adminId }).sort({ createdAt: -1 });
  }


}