import { DEFAULT_TENANT_ID, WORKSPACE_PRESETS } from '../config/workspaces';
import { SystemSetting, type ISystemSetting, type ISystemSettingDocument } from '../models/SystemSetting';

export class SettingRepository {
  /** Workspace profiles, default first. */
  async list(): Promise<ISystemSettingDocument[]> {
    await this.ensureDefault();
    return SystemSetting.find().sort({ isDefault: -1, organizationName: 1 });
  }

  async findByTenant(tenantId: string): Promise<ISystemSettingDocument | null> {
    return SystemSetting.findOne({ tenantId: tenantId.trim().toLowerCase() });
  }

  /** The named workspace, or the default one when none is named / it does not exist. */
  async get(tenantId?: string): Promise<ISystemSettingDocument> {
    if (tenantId) {
      const named = await this.findByTenant(tenantId);
      if (named) return named;
    }
    return this.ensureDefault();
  }

  async create(data: ISystemSetting): Promise<ISystemSettingDocument> {
    return SystemSetting.create({ ...data, isDefault: false });
  }

  async update(tenantId: string | undefined, data: Partial<ISystemSetting>): Promise<ISystemSettingDocument> {
    const current = await this.get(tenantId);
    // The slug is an identity; it is never edited after creation.
    const { tenantId: _ignored, isDefault: _isDefault, ...editable } = data;
    current.set(editable);
    await current.save();
    return current;
  }

  /** Makes sure there is a default workspace (a fresh database has none until the presets are installed). */
  async ensureDefault(): Promise<ISystemSettingDocument> {
    const existing = (await SystemSetting.findOne({ isDefault: true })) ?? (await SystemSetting.findOne().sort({ createdAt: 1 }));
    if (existing) return existing;
    const preset = WORKSPACE_PRESETS.find((entry) => entry.tenantId === DEFAULT_TENANT_ID) ?? WORKSPACE_PRESETS[0];
    return SystemSetting.create(preset);
  }

  /** Installs any missing preset workspace; existing profiles are left exactly as the operator edited them. */
  async ensurePresets(): Promise<number> {
    let created = 0;
    for (const preset of WORKSPACE_PRESETS) {
      const exists = await SystemSetting.exists({ tenantId: preset.tenantId });
      if (exists) continue;
      await SystemSetting.create(preset);
      created += 1;
    }
    return created;
  }
}

export const settingRepository = new SettingRepository();
