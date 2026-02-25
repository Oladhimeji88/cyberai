import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class WebhookService {
  constructor(private readonly prisma: PrismaService) {}

  async emit(orgId: string, event: string, payload: Record<string, unknown>) {
    const hooks = await this.prisma.webhook.findMany({ where: { orgId, enabled: true, events: { has: event } } });
    await Promise.all(
      hooks.map(async (hook) => {
        const body = JSON.stringify({ event, payload, ts: new Date().toISOString() });
        const sig = crypto.createHmac('sha256', hook.secret).update(body).digest('hex');
        try {
          await fetch(hook.url, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-signature': sig },
            body,
          });
        } catch {
          // swallow webhook errors in MVP
        }
      }),
    );
  }
}