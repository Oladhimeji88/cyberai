import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PolicyGuard } from '../policy/policy.guard';
import { RequirePolicy } from '../policy/policy.decorator';
import { AlertsService } from './alerts.service';

@ApiTags('alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PolicyGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @RequirePolicy('read', 'alert')
  @Get()
  list(@Req() req: any, @Query('severity') severity?: string, @Query('status') status?: string, @Query('type') type?: string) {
    return this.alerts.list(req.user.orgId, severity, status, type);
  }

  @RequirePolicy('respond', 'alert')
  @Post(':id/respond')
  respond(@Req() req: any, @Param('id') id: string, @Body('actionType') actionType: string) {
    return this.alerts.respond(req.user.orgId, req.user.sub, id, actionType);
  }
}