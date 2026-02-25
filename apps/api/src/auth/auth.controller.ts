import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto';
import { JwtAuthGuard } from './jwt.guard';
import { Throttle } from '@nestjs/throttler';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('enroll')
  enroll(@Body() body: any) {
    return this.auth.enrollOrg(body.orgName, body.adminEmail, body.password);
  }

  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: any) {
    return this.auth.login(dto.email, dto.password, dto.orgName, dto.mfaCode, req.headers['user-agent'], req.ip, dto.deviceLabel);
  }

  @Post('refresh')
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.auth.refresh(refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('mfa/setup')
  setup(@Req() req: any) {
    return this.auth.setupMfa(req.user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('mfa/enable')
  enable(@Req() req: any, @Body('token') token: string) {
    return this.auth.enableMfa(req.user.sub, token);
  }
}
