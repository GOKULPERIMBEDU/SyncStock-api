import { Staff, type IStaff, type IStaffDocument } from '../models/Staff';

export class StaffRepository {
  async create(data: IStaff): Promise<IStaffDocument> {
    return Staff.create(data);
  }

  async findAll(): Promise<IStaffDocument[]> {
    return Staff.find().sort({ joinedDate: -1 });
  }

  async findById(id: string): Promise<IStaffDocument | null> {
    return Staff.findById(id);
  }

  async findByEmail(email: string): Promise<IStaffDocument | null> {
    return Staff.findOne({ email: email.toLowerCase() });
  }

  async updateById(id: string, data: Partial<IStaff>): Promise<IStaffDocument | null> {
    return Staff.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
  }

  async deleteById(id: string): Promise<IStaffDocument | null> {
    return Staff.findByIdAndDelete(id);
  }

  async countActive(): Promise<number> {
    return Staff.countDocuments({ status: 'Active' });
  }
}

export const staffRepository = new StaffRepository();
