import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto.service';
import { AuditService } from '../audit/audit.service';
import { WebhookService } from '../common/webhook.service';

@Injectable()
export class SecretsService {
  private readonly crypto = new CryptoService();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly webhook: WebhookService,
  ) {}

  private async orgKek(orgId: string): Promise<Buffer> {
    const org = await this.prisma.org.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Org not found');
    const rootSecret = process.env.ORG_ROOT_SECRET || 'DemoOrgRootSecret!';
    return this.crypto.deriveKek(rootSecret, org.rootSecretSalt);
  }

  async create(orgId: string, actorId: string, body: any) {
    const kek = await this.orgKek(orgId);
    const encrypted = this.crypto.envelopeEncrypt(body.value, kek);
    const secret = await this.prisma.secret.create({
      data: {
        orgId,
        name: body.name,
        description: body.description || '',
        encryptedDek: encrypted.encryptedDek,
        versions: {
          create: {
            version: 1,
            ciphertext: encrypted.ciphertext,
            nonce: encrypted.nonce,
            tag: encrypted.tag,
            createdBy: actorId,
          },
        },
      },
      include: { versions: true },
    });
    await this.audit.log(orgId, 'SECRET_CREATE', `secret:${secret.id}`, actorId, { name: body.name });
    return secret;
  }

  async get(orgId: string, actorId: string, id: string) {
    const secret = await this.prisma.secret.findFirst({ where: { id, orgId }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } });
    if (!secret) throw new NotFoundException();
    const latest = secret.versions[0];
    const kek = await this.orgKek(orgId);
    const value = this.crypto.envelopeDecrypt({ encryptedDek: secret.encryptedDek, ciphertext: latest.ciphertext, nonce: latest.nonce, tag: latest.tag }, kek);
    await this.audit.log(orgId, 'SECRET_READ', `secret:${id}`, actorId, {});
    return { ...secret, value };
  }

  async list(orgId: string) {
    return this.prisma.secret.findMany({ where: { orgId }, include: { versions: true, rotationPolicy: true } });
  }

  async rotateNow(orgId: string, actorId: string, secretId: string, value?: string) {
    const secret = await this.prisma.secret.findFirst({ where: { id: secretId, orgId }, include: { versions: { orderBy: { version: 'desc' }, take: 1 }, rotationPolicy: true } });
    if (!secret) throw new NotFoundException();
    const newVersion = (secret.versions[0]?.version || 0) + 1;
    const nextValue = value || `rotated-${Date.now()}`;
    const kek = await this.orgKek(orgId);
    const encrypted = this.crypto.envelopeEncrypt(nextValue, kek);

    await this.prisma.$transaction([
      this.prisma.secret.update({ where: { id: secret.id }, data: { encryptedDek: encrypted.encryptedDek } }),
      this.prisma.secretVersion.create({
        data: {
          secretId,
          version: newVersion,
          ciphertext: encrypted.ciphertext,
          nonce: encrypted.nonce,
          tag: encrypted.tag,
          createdBy: actorId,
        },
      }),
      this.prisma.rotationRun.create({
        data: {
          policyId: secret.rotationPolicy?.id || (await this.ensureAdhocPolicy(secretId)),
          status: 'SUCCESS',
          output: { version: newVersion },
        },
      }),
    ]);

    await this.audit.log(orgId, 'SECRET_ROTATE', `secret:${secretId}`, actorId, { version: newVersion });
    await this.webhook.emit(orgId, 'secret.rotated', { secretId, version: newVersion });
    return { success: true, version: newVersion };
  }

  private async ensureAdhocPolicy(secretId: string): Promise<string> {
    const existing = await this.prisma.rotationPolicy.findUnique({ where: { secretId } });
    if (existing) return existing.id;
    const created = await this.prisma.rotationPolicy.create({
      data: { secretId, type: 'webhook', scheduleCron: '0 0 * * *', config: { adhoc: true }, enabled: true },
    });
    return created.id;
  }

  async setPolicy(orgId: string, actorId: string, secretId: string, body: any) {
    const secret = await this.prisma.secret.findFirst({ where: { id: secretId, orgId } });
    if (!secret) throw new NotFoundException();
    if (!body.scheduleCron) throw new BadRequestException('scheduleCron required');
    const policy = await this.prisma.rotationPolicy.upsert({
      where: { secretId },
      create: { secretId, type: body.type || 'webhook', scheduleCron: body.scheduleCron, config: body.config || {}, enabled: true },
      update: { type: body.type || 'webhook', scheduleCron: body.scheduleCron, config: body.config || {}, enabled: body.enabled ?? true },
    });
    await this.audit.log(orgId, 'ROTATION_POLICY_SET', `secret:${secretId}`, actorId, { policyId: policy.id });
    return policy;
  }
}