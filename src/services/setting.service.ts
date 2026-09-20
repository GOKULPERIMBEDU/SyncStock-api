import type { ISystemSetting } from '../models/SystemSetting';
import { settingRepository } from '../repositories/setting.repository';

export class SettingService {
  async get() {
    return settingRepository.get();
  }

  async update(input: Partial<ISystemSetting>) {
    return settingRepository.update(input);
  }
}

export const settingService = new SettingService();
