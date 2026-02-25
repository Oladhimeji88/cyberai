import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SecretsService } from './secrets.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PolicyGuard } from '../policy/policy.guard';
import { RequirePolicy } from '../policy/policy.decorator';

@ApiTags('secrets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PolicyGuard)
@Controller('secrets')
export class SecretsController {
  constructor(private readonly secrets: SecretsService) {}

  @RequirePolicy('read', 'secret')
  @Get()
  list(@Req() req: any) {
    return this.secrets.list(req.user.orgId);
  }

  @RequirePolicy('create', 'secret')
  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.secrets.create(req.user.orgId, req.user.sub, body);
  }

  @RequirePolicy('read', 'secret')
  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.secrets.get(req.user.orgId, req.user.sub, id);
  }

  @RequirePolicy('rotate', 'secret')
  @Post(':id/rotate')
  rotate(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.secrets.rotateNow(req.user.orgId, req.user.sub, id, body.value);
  }

  @RequirePolicy('update', 'secret')
  @Post(':id/policy')
  policy(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.secrets.setPolicy(req.user.orgId, req.user.sub, id, body);
  }
}