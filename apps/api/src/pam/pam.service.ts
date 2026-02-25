import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WebhookService } from '../common/webhook.service';
import * as crypto from 'crypto';

@Injectable()
export class PamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly webhook: WebhookService,
  ) {}

  listTargets(orgId: string) {
    return this.prisma.pamTarget.findMany({ where: { orgId } });
  }

  createTarget(orgId: string, actorId: string, body: any) {
    return this.prisma.pamTarget.create({
      data: {
        orgId,
        name: body.name,
        type: body.type || 'SSH',
        host: body.host,
        port: Number(body.port || 22),
        username: body.username || 'ubuntu',
        metadata: body.metadata || {},
      },
    }).then(async (target) => {
      await this.audit.log(orgId, 'PAM_TARGET_CREATE', `pam_target:${target.id}`, actorId, { name: target.name });
      return target;
    });
  }

  createRequest(orgId: string, requesterId: string, body: any) {
    return this.prisma.pamRequest.create({
      data: {
        orgId,
        requesterId,
        targetId: body.targetId,
        reason: body.reason,
        requestedUntil: new Date(body.requestedUntil),
      },
    });
  }

  listRequests(orgId: string) {
    return this.prisma.pamRequest.findMany({ where: { orgId }, include: { target: true, approvals: true, requester: true } });
  }

  async approve(orgId: string, approverId: string, requestId: string, body: any) {
    const request = await this.prisma.pamRequest.findFirst({ where: { id: requestId, orgId } });
    if (!request) throw new NotFoundException();
    if (request.status !== 'PENDING') throw new BadRequestException('Not pending');

    const now = new Date();
    const end = new Date(body.windowEnd || Date.now() + 60 * 60 * 1000);
    const ephemeralCred = this.issueEphemeralCredential(request.id, end);

    await this.prisma.$transaction([
      this.prisma.pamApproval.create({
        data: {
          requestId,
          approverId,
          approved: true,
          reason: body.reason || 'Approved',
          windowStart: now,
          windowEnd: end,
        },
      }),
      this.prisma.pamRequest.update({ where: { id: requestId }, data: { status: 'APPROVED', ephemeralCred } }),
    ]);

    await this.audit.log(orgId, 'PAM_REQUEST_APPROVED', `pam_request:${requestId}`, approverId, { windowEnd: end.toISOString() });
    await this.webhook.emit(orgId, 'pam.approved', { requestId, windowEnd: end.toISOString() });
    return { approved: true, ephemeralCred };
  }

  async startSession(orgId: string, actorId: string, requestId: string) {
    const req = await this.prisma.pamRequest.findFirst({ where: { id: requestId, orgId } });
    if (!req || req.status !== 'APPROVED') throw new BadRequestException('Request not approved');
    await this.prisma.pamRequest.update({ where: { id: req.id }, data: { status: 'ACTIVE' } });
    const session = await this.prisma.pamSession.create({
      data: {
        orgId,
        requestId,
        commandLog: [],
        metadata: { startedBy: actorId },
      },
    });
    await this.audit.log(orgId, 'PAM_SESSION_START', `pam_session:${session.id}`, actorId, { requestId });
    return session;
  }

  async appendCommand(orgId: string, actorId: string, sessionId: string, command: string) {
    const session = await this.prisma.pamSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException();
    const logs = Array.isArray(session.commandLog) ? session.commandLog as any[] : [];
    logs.push({ ts: new Date().toISOString(), actorId, command });
    await this.prisma.pamSession.update({ where: { id: sessionId }, data: { commandLog: logs } });
    await this.audit.log(orgId, 'PAM_COMMAND', `pam_session:${sessionId}`, actorId, { command });
    return { ok: true };
  }

  async stopSession(orgId: string, actorId: string, sessionId: string) {
    await this.prisma.pamSession.update({ where: { id: sessionId }, data: { endedAt: new Date() } });
    await this.audit.log(orgId, 'PAM_SESSION_STOP', `pam_session:${sessionId}`, actorId, {});
    return { stopped: true };
  }

  activeSessions(orgId: string) {
    return this.prisma.pamSession.findMany({ where: { orgId, endedAt: null }, include: { request: true } });
  }

  private issueEphemeralCredential(requestId: string, expiresAt: Date) {
    const raw = `${requestId}:${expiresAt.toISOString()}:${crypto.randomBytes(12).toString('hex')}`;
    return Buffer.from(raw).toString('base64url');
  }
}