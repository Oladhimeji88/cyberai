import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PolicyGuard } from '../policy/policy.guard';
import { RequirePolicy } from '../policy/policy.decorator';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import { AuditService } from '../audit/audit.service';

@ApiTags('platform')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PolicyGuard)
@Controller()
export class PlatformController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @RequirePolicy('read', 'dashboard')
  @Get('dashboard')
  async dashboard(@Req() req: any) {
    const orgId = req.user.orgId;
    const [findings, alerts, sessions, rotations, posture] = await Promise.all([
      this.prisma.finding.count({ where: { orgId, status: 'OPEN' } }),
      this.prisma.alert.count({ where: { orgId, status: 'OPEN' } }),
      this.prisma.pamSession.findMany({ where: { orgId }, take: 5, orderBy: { startedAt: 'desc' } }),
      this.prisma.rotationRun.findMany({ where: { policy: { secret: { orgId } } }, take: 5, orderBy: { ranAt: 'desc' } }),
      this.prisma.postureRun.findFirst({ where: { orgId }, orderBy: { createdAt: 'desc' } }),
    ]);
    return { postureScore: posture?.score || 0, findings, openAlerts: alerts, recentSessions: sessions, recentRotations: rotations };
  }

  @RequirePolicy('read', 'audit')
  @Get('audit')
  audit(@Req() req: any) {
    return this.prisma.auditLog.findMany({ where: { orgId: req.user.orgId }, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  @RequirePolicy('create', 'user')
  @Post('users')
  async createUser(@Req() req: any, @Body() body: any) {
    const hash = await argon2.hash(body.password);
    return this.prisma.user.create({
      data: { orgId: req.user.orgId, email: body.email, passwordHash: hash, role: body.role || 'REQUESTER' },
    });
  }

  @RequirePolicy('read', 'user')
  @Get('users')
  users(@Req() req: any) {
    return this.prisma.user.findMany({ where: { orgId: req.user.orgId } });
  }

  @RequirePolicy('update', 'user')
  @Post('users/role')
  async updateRole(@Req() req: any, @Body() body: any) {
    const updated = await this.prisma.user.update({ where: { id: body.userId }, data: { role: body.role } });
    await this.audit.log(req.user.orgId, 'ROLE_CHANGE', `user:${body.userId}`, req.user.sub, { role: body.role });
    return updated;
  }

  @RequirePolicy('create', 'webhook')
  @Post('webhooks')
  webhooks(@Req() req: any, @Body() body: any) {
    return this.prisma.webhook.create({
      data: {
        orgId: req.user.orgId,
        name: body.name,
        url: body.url,
        secret: body.secret,
        enabled: body.enabled ?? true,
        events: body.events || ['alert.created', 'secret.rotated', 'pam.approved'],
      },
    });
  }

  @RequirePolicy('create', 'api_token')
  @Post('api-tokens')
  async apiToken(@Req() req: any, @Body() body: any) {
    const raw = `${body.name}-${Date.now()}-${Math.random()}`;
    const token = Buffer.from(raw).toString('base64url');
    const hash = await import('crypto').then((c) => c.createHash('sha256').update(token).digest('hex'));
    const created = await this.prisma.apiToken.create({ data: { orgId: req.user.orgId, name: body.name, tokenHash: hash } });
    return { id: created.id, token };
  }
}
