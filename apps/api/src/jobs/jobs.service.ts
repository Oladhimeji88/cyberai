import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { CnappService } from '../cnapp/cnapp.service';
import { PrismaService } from '../prisma/prisma.service';
import { SecretsService } from '../secrets/secrets.service';
import { ItrdService } from '../itdr/itdr.service';

@Injectable()
export class JobsService implements OnModuleInit {
  private connection = new IORedis(process.env.REDIS_URL || 'redis://redis:6379');
  private queue = new Queue('sec-jobs', { connection: this.connection });

  constructor(
    private readonly cnapp: CnappService,
    private readonly prisma: PrismaService,
    private readonly secrets: SecretsService,
    private readonly itdr: ItrdService,
  ) {}

  async onModuleInit() {
    await this.queue.upsertJobScheduler('cspm-scan', { pattern: '*/10 * * * *' }, { name: 'cspm-scan', data: {} });
    await this.queue.upsertJobScheduler('secret-rotate', { pattern: '*/5 * * * *' }, { name: 'secret-rotate', data: {} });
    await this.queue.upsertJobScheduler('alert-correlate', { pattern: '*/2 * * * *' }, { name: 'alert-correlate', data: {} });

    const worker = new Worker(
      'sec-jobs',
      async (job) => {
        if (job.name === 'cspm-scan') {
          const orgs = await this.prisma.org.findMany();
          for (const org of orgs) {
            await this.cnapp.runScan(org.id);
          }
        }

        if (job.name === 'secret-rotate') {
          const policies = await this.prisma.rotationPolicy.findMany({ where: { enabled: true }, include: { secret: true } });
          for (const p of policies) {
            await this.secrets.rotateNow(p.secret.orgId, 'system', p.secretId);
            await this.prisma.rotationPolicy.update({ where: { id: p.id }, data: { lastRunAt: new Date() } });
          }
        }

        if (job.name === 'alert-correlate') {
          const orgs = await this.prisma.org.findMany();
          for (const org of orgs) {
            await this.itdr.correlate(org.id);
          }
        }
      },
      { connection: this.connection },
    );

    worker.on('failed', () => undefined);
  }
}