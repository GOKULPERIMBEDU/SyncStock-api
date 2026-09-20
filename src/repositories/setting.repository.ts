import { SystemSetting, type ISystemSetting, type ISystemSettingDocument } from '../models/SystemSetting';

export class SettingRepository {
  async get(): Promise<ISystemSettingDocument> {
    const existing = await SystemSetting.findOne();
    if (existing) return existing;
    return SystemSetting.create({ companyName: 'SyncStock India Pvt Ltd', currency: 'INR', taxRate: 18 });
  }

  async update(data: Partial<ISystemSetting>): Promise<ISystemSettingDocument> {
    const current = await this.get();
    current.set(data);
    await current.save();
    return current;
  }
}

export const settingRepository = new SettingRepository();
