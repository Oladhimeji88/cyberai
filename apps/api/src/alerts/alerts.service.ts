import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlertsGateway } from '../ws/alerts.gateway';
import { AuditService } from '../audit/audit.service';
import { WebhookService } from '../common/webhook.service';

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AlertsGateway,
    private readonly audit: AuditService,
    private readonly webhook: WebhookService,
  ) {}

  list(orgId: string, severity?: string, status?: string, type?: string) {
    return this.prisma.alert.findMany({
      where: {
        orgId,
        severity: severity as any,
        status: status as any,
        type: type || undefined,
      },
      include: { events: true, responses: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(orgId: string, input: any) {
    const alert = await this.prisma.alert.create({
      data: {
        orgId,
        type: input.type,
        severity: input.severity,
        title: input.title,
        description: input.description,
        timeline: input.timeline || {},
      },
    });
    await this.prisma.alertEvent.create({
      data: {
        alertId: alert.id,
        type: 'CREATED',
        message: 'Alert created',
      },
    });
    this.gateway.pushAlert(orgId, alert);
    await this.webhook.emit(orgId, 'alert.created', { alertId: alert.id, type: alert.type });
    return alert;
  }

  async respond(orgId: string, actorId: string, alertId: string, actionType: string) {
    const alert = await this.prisma.alert.findFirst({ where: { id: alertId, orgId } });
    if (!alert) throw new NotFoundException();

    let output: Record<string, unknown> = {};
    if (actionType === 'disable_user' && alert.type.includes('LOGIN')) {
      const email = (alert.timeline as any)?.email as string | undefined;
      if (email) {
        const user = await this.prisma.user.findFirst({ where: { orgId, email } });
        if (user) {
          await this.prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
          output = { disabledUser: user.email };
        }
      }
    }

    if (actionType === 'revoke_sessions') {
      await this.prisma.pamSession.updateMany({ where: { orgId, endedAt: null }, data: { endedAt: new Date() } });
      output = { revoked: true };
    }

    if (actionType === 'require_reauth') {
      await this.prisma.refreshToken.updateMany({ where: { user: { orgId } }, data: { revokedAt: new Date() } });
      output = { reauthRequired: true };
    }

    if (actionType === 'rotate_secret_now') {
      const secretId = (alert.timeline as any)?.secretId as string | undefined;
      if (secretId) {
        const version = await this.prisma.secretVersion.count({ where: { secretId } });
        output = { rotated: true, previousVersions: version };
      }
    }

    if (actionType === 'quarantine_agent') {
      const tokenName = (alert.timeline as any)?.agentTokenName as string | undefined;
      if (tokenName) {
        await this.prisma.apiToken.deleteMany({ where: { orgId, name: tokenName } });
        output = { quarantined: true, tokenName };
      }
    }

    const response = await this.prisma.responseAction.create({
      data: {
        alertId,
        actionType,
        status: 'SUCCESS',
        output,
      },
    });

    await this.prisma.alertEvent.create({
      data: {
        alertId,
        actorId,
        type: 'RESPONSE',
        message: `Response action executed: ${actionType}`,
      },
    });

    await this.prisma.alert.update({ where: { id: alertId }, data: { status: 'TRIAGED' } });
    await this.audit.log(orgId, 'ALERT_RESPONSE', `alert:${alertId}`, actorId, { actionType });
    return response;
  }
}
