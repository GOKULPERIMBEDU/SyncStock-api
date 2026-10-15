import type { ISystemSetting } from '../models/SystemSetting';
import { settingRepository } from '../repositories/setting.repository';
import { AppError } from '../utils/AppError';

export class SettingService {
  /** The active workspace (named by `X-Tenant-Id`, otherwise the default one). */
  async get(tenantId?: string) {
    return settingRepository.get(tenantId);
  }

  /** Every workspace profile, so the header switcher can offer them to any signed-in role. */
  async list() {
    return settingRepository.list();
  }

  async update(tenantId: string | undefined, input: Partial<ISystemSetting>) {
    return settingRepository.update(tenantId, input);
  }

  async createWorkspace(input: Omit<ISystemSetting, 'companyName' | 'isDefault'>) {
    if (await settingRepository.findByTenant(input.tenantId)) {
      throw new AppError(409, `A workspace with id "${input.tenantId}" already exists`);
    }
    return settingRepository.create({ ...input, companyName: input.organizationName, isDefault: false });
  }
}

export const settingService = new SettingService();
