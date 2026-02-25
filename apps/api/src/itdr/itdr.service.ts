import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';

@Injectable()
export class ItrdService {
  constructor(private readonly prisma: PrismaService, private readonly alerts: AlertsService) {}

  async correlate(orgId: string) {
    const oneHour = new Date(Date.now() - 60 * 60 * 1000);
    const failed = await this.prisma.auditLog.findMany({
      where: { orgId, action: 'AUTH_FAIL', createdAt: { gt: oneHour } },
      orderBy: { createdAt: 'desc' },
    });

    const byEmail: Record<string, number> = {};
    for (const item of failed) {
      const email = (item.metadata as any)?.email || 'unknown';
      byEmail[email] = (byEmail[email] || 0) + 1;
    }

    for (const [email, count] of Object.entries(byEmail)) {
      if (count >= 5) {
        await this.alerts.create(orgId, {
          type: 'ITDR_EXCESSIVE_FAILED_LOGINS',
          severity: 'HIGH',
          title: 'ITDR: Excessive failed logins',
          description: `${email} had ${count} failed logins in the last hour`,
          timeline: { email, count },
        });
      }
    }

    const privilegeChanges = await this.prisma.auditLog.findMany({
      where: { orgId, action: 'ROLE_CHANGE', createdAt: { gt: oneHour } },
    });
    if (privilegeChanges.length > 3) {
      await this.alerts.create(orgId, {
        type: 'ITDR_PRIV_ESCALATION_PATTERN',
        severity: 'CRITICAL',
        title: 'ITDR: Privilege escalation pattern',
        description: 'Multiple role changes detected over short period',
        timeline: { count: privilegeChanges.length },
      });
    }

    const secretReads = await this.prisma.auditLog.findMany({
      where: { orgId, action: 'SECRET_READ', createdAt: { gt: oneHour } },
    });
    const baseline = 2;
    if (secretReads.length > baseline * 3) {
      await this.alerts.create(orgId, {
        type: 'ITDR_SECRET_EXFIL_PATTERN',
        severity: 'HIGH',
        title: 'ITDR: Secret access anomaly',
        description: 'Secret reads exceeded baseline frequency',
        timeline: { reads: secretReads.length, baseline },
      });
    }
  }
}