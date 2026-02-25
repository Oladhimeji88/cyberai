import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PolicyGuard } from '../policy/policy.guard';
import { RequirePolicy } from '../policy/policy.decorator';
import { PamService } from './pam.service';

@ApiTags('pam')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PolicyGuard)
@Controller('pam')
export class PamController {
  constructor(private readonly pam: PamService) {}

  @RequirePolicy('read', 'pam_target')
  @Get('targets')
  targets(@Req() req: any) {
    return this.pam.listTargets(req.user.orgId);
  }

  @RequirePolicy('create', 'pam_target')
  @Post('targets')
  createTarget(@Req() req: any, @Body() body: any) {
    return this.pam.createTarget(req.user.orgId, req.user.sub, body);
  }

  @RequirePolicy('create', 'pam_request')
  @Post('requests')
  createRequest(@Req() req: any, @Body() body: any) {
    return this.pam.createRequest(req.user.orgId, req.user.sub, body);
  }

  @RequirePolicy('read', 'pam_request')
  @Get('requests')
  list(@Req() req: any) {
    return this.pam.listRequests(req.user.orgId);
  }

  @RequirePolicy('approve', 'pam_request')
  @Post('requests/:id/approve')
  approve(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.pam.approve(req.user.orgId, req.user.sub, id, body);
  }

  @RequirePolicy('start', 'pam_session')
  @Post('requests/:id/start')
  start(@Req() req: any, @Param('id') id: string) {
    return this.pam.startSession(req.user.orgId, req.user.sub, id);
  }

  @RequirePolicy('update', 'pam_session')
  @Post('sessions/:id/command')
  command(@Req() req: any, @Param('id') id: string, @Body('command') command: string) {
    return this.pam.appendCommand(req.user.orgId, req.user.sub, id, command);
  }

  @RequirePolicy('update', 'pam_session')
  @Post('sessions/:id/stop')
  stop(@Req() req: any, @Param('id') id: string) {
    return this.pam.stopSession(req.user.orgId, req.user.sub, id);
  }

  @RequirePolicy('read', 'pam_session')
  @Get('sessions/active')
  active(@Req() req: any) {
    return this.pam.activeSessions(req.user.orgId);
  }
}