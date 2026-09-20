import { User, type IUser, type IUserDocument } from '../models/User';

export class UserRepository {
  async create(data: IUser): Promise<IUserDocument> {
    return User.create(data);
  }

  async findAll(): Promise<IUserDocument[]> {
    return User.find().sort({ createdAt: -1 });
  }

  async findById(id: string): Promise<IUserDocument | null> {
    return User.findById(id);
  }

  async findByEmail(email: string, withPassword = false): Promise<IUserDocument | null> {
    const query = User.findOne({ email: email.toLowerCase() });
    return withPassword ? query.select('+password') : query;
  }

  async findByResetToken(token: string): Promise<IUserDocument | null> {
    return User.findOne({
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: new Date() },
    }).select('+password');
  }

  async updateById(id: string, data: Partial<IUser>): Promise<IUserDocument | null> {
    return User.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
  }

  async deleteById(id: string): Promise<IUserDocument | null> {
    return User.findByIdAndDelete(id);
  }
}

export const userRepository = new UserRepository();
