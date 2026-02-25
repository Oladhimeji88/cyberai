import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { CryptoService } from '../src/common/crypto.service';

const prisma = new PrismaClient();
const c = new CryptoService();

async function main() {
  const salt = crypto.randomBytes(12).toString('hex');
  const rootSecret = process.env.ORG_ROOT_SECRET || 'DemoOrgRootSecret!';
  const verifier = await c.createRootVerifier(rootSecret, salt);

  const org = await prisma.org.upsert({
    where: { id: 'demo-org' },
    update: {},
    create: {
      id: 'demo-org',
      name: 'DemoCorp',
      rootSecretSalt: salt,
      rootSecretVerifier: verifier,
    },
  });

  const mkUser = async (email: string, role: any) => {
    const passwordHash = await argon2.hash('Password123!');
    return prisma.user.upsert({
      where: { orgId_email: { orgId: org.id, email } },
      update: { role },
      create: { orgId: org.id, email, role, passwordHash, mfaEnabled: false },
    });
  };

  await mkUser('admin@democorp.test', 'ADMIN');
  await mkUser('sec@democorp.test', 'SECURITY');
  await mkUser('dev@democorp.test', 'REQUESTER');

  const project = await prisma.project.create({ data: { orgId: org.id, name: 'core-platform' } });
  await prisma.environment.create({ data: { projectId: project.id, name: 'prod' } });

  const target = await prisma.pamTarget.create({
    data: {
      orgId: org.id,
      name: 'demo-ssh',
      type: 'SSH',
      host: process.env.DEMO_SSH_HOST || 'localhost',
      port: Number(process.env.DEMO_SSH_PORT || 2222),
      username: process.env.DEMO_SSH_USER || 'demo',
      metadata: {},
    },
  });

  const kek = await c.deriveKek(rootSecret, salt);
  const encrypted = c.envelopeEncrypt('sk_test_demo_123', kek);

  const secret = await prisma.secret.create({
    data: {
      orgId: org.id,
      name: 'stripe_api_key',
      description: 'Demo Stripe key',
      encryptedDek: encrypted.encryptedDek,
      versions: {
        create: {
          version: 1,
          ciphertext: encrypted.ciphertext,
          nonce: encrypted.nonce,
          tag: encrypted.tag,
          createdBy: 'seed',
        },
      },
    },
  });

  await prisma.rotationPolicy.create({
    data: {
      secretId: secret.id,
      type: 'webhook',
      scheduleCron: '*/30 * * * *',
      config: { endpoint: 'http://localhost:9999/rotate' },
      enabled: true,
    },
  });

  const tokenRaw = 'agent-demo-token';
  const tokenHash = crypto.createHash('sha256').update(tokenRaw).digest('hex');
  await prisma.apiToken.create({ data: { orgId: org.id, name: 'demo-agent', tokenHash } });

  console.log(`Seed complete for ${org.name}. PAM target=${target.name}. agent_token=${tokenRaw}`);
}

main().finally(async () => prisma.$disconnect());