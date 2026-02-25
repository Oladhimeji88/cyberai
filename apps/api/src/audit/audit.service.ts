import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(orgId: string, action: string, resource: string, actorId?: string, metadata: Record<string, unknown> = {}) {
    await this.prisma.auditLog.create({
      data: { orgId, action, resource, actorId, metadata },
    });
  }
}