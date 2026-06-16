import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SubadminRepository } from './subadmin.repository';

@Injectable()
export class SubadminService {
  constructor(private subadminRepo: SubadminRepository) {}

  async create(
    userId: string,
    firstName: string,
    lastName: string,
    profilePicture?: string,
  ): Promise<Record<string, unknown>> {
    if (!userId) throw new BadRequestException('User ID is required');
    if (!firstName) throw new BadRequestException('First name is required');
    if (!lastName) throw new BadRequestException('Last name is required');

    return this.subadminRepo.create(
      userId,
      firstName,
      lastName,
      profilePicture,
    );
  }

  async findByUserId(userId: string): Promise<Record<string, unknown> | null> {
    return this.subadminRepo.findByUserId(userId);
  }

  async findById(id: string): Promise<Record<string, unknown>> {
    const subadmin = await this.subadminRepo.findById(id);
    if (!subadmin) throw new NotFoundException('Subadmin not found');
    return subadmin;
  }

  async findAll(params?: { limit?: number; offset?: number }): Promise<{
    subadmins: Record<string, unknown>[];
    total: number;
  }> {
    return this.subadminRepo.findAll(params);
  }

  async update(
    id: string,
    fields: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    const subadmin = await this.subadminRepo.findById(id);
    if (!subadmin) throw new NotFoundException('Subadmin not found');
    return this.subadminRepo.update(id, fields);
  }

  async delete(id: string): Promise<boolean> {
    const subadmin = await this.subadminRepo.findById(id);
    if (!subadmin) throw new NotFoundException('Subadmin not found');
    return this.subadminRepo.delete(id);
  }

  async grantPermissions(
    id: string,
    permissions: unknown[],
  ): Promise<unknown[] | null> {
    if (!Array.isArray(permissions)) {
      throw new BadRequestException('permissions must be an array');
    }
    for (const p of permissions) {
      if (!p || typeof p !== 'object') {
        throw new BadRequestException('each permission must be an object');
      }
      const rp: any = p as any;
      if (!rp.resource) {
        throw new BadRequestException(
          'each permission must have a resource field',
        );
      }
      if (!rp.action || !Array.isArray(rp.action)) {
        throw new BadRequestException(
          'each permission must have an action field that is an array of strings',
        );
      }
      if (rp.action.length === 0) {
        throw new BadRequestException(
          'action array must have at least one element',
        );
      }
      for (const action of rp.action) {
        if (typeof action !== 'string' || !action.trim()) {
          throw new BadRequestException(
            'each action in the action array must be a non-empty string',
          );
        }
      }
    }

    let subadmin = await this.subadminRepo.findById(id);
    if (!subadmin) {
      subadmin = await this.subadminRepo.findByUserId(id);
    }
    if (!subadmin) throw new NotFoundException('Subadmin not found');
    try {
      const updated = await this.subadminRepo.updatePermissionsAdd(
        subadmin.id as string,
        permissions,
      );
      return updated;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(msg);
    }
  }

  async removePermissions(
    id: string,
    permissions: unknown[],
  ): Promise<unknown[] | null> {
    if (!Array.isArray(permissions)) {
      throw new BadRequestException('permissions must be an array');
    }
    for (const p of permissions) {
      if (!p || typeof p !== 'object') {
        throw new BadRequestException('each permission must be an object');
      }
      const rp: any = p as any;
      if (!rp.resource) {
        throw new BadRequestException(
          'each permission must have a resource field',
        );
      }
      if (!rp.action || !Array.isArray(rp.action)) {
        throw new BadRequestException(
          'each permission must have an action field that is an array of strings',
        );
      }
      if (rp.action.length === 0) {
        throw new BadRequestException(
          'action array must have at least one element',
        );
      }
      for (const action of rp.action) {
        if (typeof action !== 'string' || !action.trim()) {
          throw new BadRequestException(
            'each action in the action array must be a non-empty string',
          );
        }
      }
    }

    let subadmin = await this.subadminRepo.findById(id);
    if (!subadmin) {
      subadmin = await this.subadminRepo.findByUserId(id);
    }
    if (!subadmin) throw new NotFoundException('Subadmin not found');

    const currentPermissions = this.normalizePermissionList(
      (subadmin.permissions as unknown[]) ?? [],
    );
    const toRemoveList = this.normalizePermissionList(permissions);
    const notPresent = this.findPermissionsNotPresent(
      currentPermissions,
      toRemoveList,
    );
    if (notPresent.length > 0) {
      const message =
        notPresent.length === 1
          ? `Permission not present: resource "${notPresent[0].resource}" does not have action(s) [${notPresent[0].actions.join(', ')}] (or resource is not assigned).`
          : `Permissions not present: ${notPresent
              .map(
                (p) =>
                  `resource "${p.resource}" action(s) [${p.actions.join(', ')}]`,
              )
              .join('; ')}. None of these are assigned to this subadmin.`;
      throw new BadRequestException(message);
    }

    try {
      const updated = await this.subadminRepo.updatePermissionsRemove(
        subadmin.id as string,
        permissions,
      );
      return updated;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(msg);
    }
  }

  private normalizePermissionList(
    permissions: unknown[],
  ): { resource: string; action: string[] }[] {
    if (!Array.isArray(permissions)) return [];
    return permissions
      .map((p) => {
        if (!p || typeof p !== 'object') return null;
        const r = p as Record<string, unknown>;
        const resource =
          typeof r.resource === 'string' ? r.resource.trim() : '';
        const action = Array.isArray(r.action)
          ? (r.action as unknown[]).filter(
              (a): a is string => typeof a === 'string' && a.trim().length > 0,
            )
          : typeof r.action === 'string' && r.action.trim()
            ? [r.action.trim()]
            : [];
        return resource ? { resource, action } : null;
      })
      .filter((x): x is { resource: string; action: string[] } => x != null);
  }

  private findPermissionsNotPresent(
    current: { resource: string; action: string[] }[],
    toRemove: { resource: string; action: string[] }[],
  ): { resource: string; actions: string[] }[] {
    const currentSet = new Map<string, Set<string>>();
    for (const p of current) {
      if (!currentSet.has(p.resource)) currentSet.set(p.resource, new Set());
      p.action.forEach((a) => currentSet.get(p.resource)!.add(a));
    }
    const notPresent: { resource: string; actions: string[] }[] = [];
    for (const p of toRemove) {
      const existingActions = currentSet.get(p.resource);
      if (!existingActions) {
        notPresent.push({ resource: p.resource, actions: [...p.action] });
        continue;
      }
      const missing = p.action.filter((a) => !existingActions.has(a));
      if (missing.length > 0) {
        notPresent.push({ resource: p.resource, actions: missing });
      }
    }
    return notPresent;
  }
}
