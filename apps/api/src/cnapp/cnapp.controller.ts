import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CnappService } from './cnapp.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PolicyGuard } from '../policy/policy.guard';
import { RequirePolicy } from '../policy/policy.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('cnapp')
@Controller('cnapp')
export class CnappController {
  constructor(private readonly cnapp: CnappService, private readonly prisma: PrismaService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PolicyGuard)
  @RequirePolicy('scan', 'cnapp')
  @Post('scan')
  run(@Req() req: any) {
    return this.cnapp.runScan(req.user.orgId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PolicyGuard)
  @RequirePolicy('update', 'cnapp')
  @Post('connect')
  async connect(@Req() req: any, @Body() body: any) {
    await this.prisma.org.update({
      where: { id: req.user.orgId },
      data: { awsRoleArn: body.roleArn, awsExternalId: body.externalId || null },
    });
    return { connected: true };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PolicyGuard)
  @RequirePolicy('read', 'finding')
  @Get('findings')
  list(@Req() req: any) {
    return this.prisma.finding.findMany({ where: { orgId: req.user.orgId }, orderBy: { createdAt: 'desc' } });
  }

  @Post('runtime/ingest')
  async ingest(@Body() body: any, @Req() req: any) {
    const token = req.headers['x-agent-token'];
    if (!token) return { accepted: false };
    const apiToken = await this.prisma.apiToken.findFirst();
    if (!apiToken) return { accepted: false };
    const crypto = await import('crypto');
    const digest = crypto.createHash('sha256').update(String(token)).digest('hex');
    if (digest !== apiToken.tokenHash) return { accepted: false };
    const created = await this.cnapp.ingestRuntime(body.orgId, body);
    return { accepted: true, findings: created.length };
  }
}
