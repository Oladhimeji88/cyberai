import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { AuditService } from './audit/audit.service';
import { SecretsController } from './secrets/secrets.controller';
import { SecretsService } from './secrets/secrets.service';
import { PamController } from './pam/pam.controller';
import { PamService } from './pam/pam.service';
import { AlertsController } from './alerts/alerts.controller';
import { AlertsService } from './alerts/alerts.service';
import { CnappController } from './cnapp/cnapp.controller';
import { CnappService } from './cnapp/cnapp.service';
import { AlertsGateway } from './ws/alerts.gateway';
import { PolicyService } from './policy/policy.service';
import { PolicyGuard } from './policy/policy.guard';
import { PlatformController } from './common/platform.controller';
import { JobsService } from './jobs/jobs.service';
import { ItrdService } from './itdr/itdr.service';
import { WebhookService } from './common/webhook.service';
import { MetricsController } from './common/metrics.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    JwtModule.register({ secret: process.env.JWT_SECRET || 'dev-secret' }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
  ],
  controllers: [AuthController, SecretsController, PamController, AlertsController, CnappController, PlatformController, MetricsController],
  providers: [AuthService, AuditService, SecretsService, PamService, AlertsService, CnappService, AlertsGateway, PolicyService, PolicyGuard, JobsService, ItrdService, WebhookService],
})
export class AppModule {}