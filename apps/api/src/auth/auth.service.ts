import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import * as speakeasy from 'speakeasy';
import * as crypto from 'crypto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  private deviceFingerprint(userAgent: string, ip: string) {
    return crypto.createHash('sha256').update(`${userAgent}:${ip}`).digest('hex');
  }

  private async issueTokens(userId: string, orgId: string, role: string) {
    const accessToken = this.jwt.sign({ sub: userId, orgId, role }, { expiresIn: '15m' });
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await argon2.hash(refreshToken);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    return { accessToken, refreshToken };
  }

  async login(email: string, password: string, orgName: string, mfaCode?: string, userAgent = 'unknown', ip = '127.0.0.1', deviceLabel = 'default') {
    const org = await this.prisma.org.findFirst({ where: { name: orgName } });
    if (!org) throw new UnauthorizedException('Invalid credentials');

    const user = await this.prisma.user.findFirst({ where: { orgId: org.id, email }, include: { mfa: true } });
    if (!user || !user.isActive) {
      await this.recordFailedLogin(org.id, email, ip);
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      await this.recordFailedLogin(org.id, email, ip);
      throw new UnauthorizedException('Invalid credentials');
    }

    if ((user.role === 'ADMIN' || user.role === 'OWNER') && !user.mfaEnabled) {
      const tokens = await this.issueTokens(user.id, org.id, user.role);
      return { mustSetupMfa: true, userId: user.id, ...tokens };
    }

    if (user.mfaEnabled) {
      if (!mfaCode) throw new UnauthorizedException('MFA required');
      const ok = speakeasy.totp.verify({ secret: user.mfa!.totpSecret, encoding: 'base32', token: mfaCode, window: 1 });
      const backupIndex = user.mfa!.backupCodes.findIndex((c) => c === mfaCode);
      if (!ok && backupIndex === -1) throw new UnauthorizedException('Invalid MFA code');
      if (backupIndex > -1) {
        const codes = [...user.mfa!.backupCodes];
        codes.splice(backupIndex, 1);
        await this.prisma.mfa.update({ where: { id: user.mfa!.id }, data: { backupCodes: codes } });
      }
    }

    const fp = this.deviceFingerprint(userAgent, ip);
    const existing = await this.prisma.device.findFirst({ where: { userId: user.id, fingerprint: fp } });
    if (!existing) {
      await this.prisma.device.create({ data: { userId: user.id, fingerprint: fp, label: deviceLabel } });
      await this.prisma.alert.create({
        data: {
          orgId: org.id,
          type: 'NEW_DEVICE',
          severity: 'MEDIUM',
          title: 'New device login',
          description: `${email} logged in from unseen device`,
          timeline: { ip, userAgent },
        },
      });
    }

    const tokens = await this.issueTokens(user.id, org.id, user.role);
    await this.audit.log(org.id, 'AUTH_LOGIN', 'user', user.id, { email, ip });
    return tokens;
  }

  async enrollOrg(orgName: string, adminEmail: string, password: string) {
    const exists = await this.prisma.org.findFirst({ where: { name: orgName } });
    if (exists) throw new BadRequestException('Org already exists');
    const salt = crypto.randomBytes(12).toString('hex');
    const rootSecret = process.env.ORG_ROOT_SECRET || 'DemoOrgRootSecret!';
    const verifier = await argon2.hash(rootSecret + salt, { type: argon2.argon2id });
    const passwordHash = await argon2.hash(password);
    const org = await this.prisma.org.create({
      data: {
        name: orgName,
        rootSecretSalt: salt,
        rootSecretVerifier: verifier,
        users: {
          create: {
            email: adminEmail,
            passwordHash,
            role: 'OWNER',
          },
        },
      },
      include: { users: true },
    });
    return { orgId: org.id, adminUserId: org.users[0].id };
  }

  async setupMfa(userId: string) {
    const secret = speakeasy.generateSecret({ name: `SentinelOne:${userId}` });
    const backupCodes = Array.from({ length: 8 }).map(() => crypto.randomBytes(4).toString('hex'));
    await this.prisma.mfa.upsert({
      where: { userId },
      create: { userId, totpSecret: secret.base32, backupCodes },
      update: { totpSecret: secret.base32, backupCodes },
    });
    return { otpauthUrl: secret.otpauth_url, backupCodes };
  }

  async enableMfa(userId: string, token: string) {
    const mfa = await this.prisma.mfa.findUnique({ where: { userId } });
    if (!mfa) throw new BadRequestException('MFA not setup');
    const ok = speakeasy.totp.verify({ secret: mfa.totpSecret, encoding: 'base32', token, window: 1 });
    if (!ok) throw new BadRequestException('Invalid token');
    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
    return { enabled: true };
  }

  async refresh(refreshToken: string) {
    const rows = await this.prisma.refreshToken.findMany({ where: { revokedAt: null, expiresAt: { gt: new Date() } }, include: { user: true } });
    for (const row of rows) {
      if (await argon2.verify(row.tokenHash, refreshToken)) {
        await this.prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
        return this.issueTokens(row.userId, row.user.orgId, row.user.role);
      }
    }
    throw new UnauthorizedException('Invalid refresh token');
  }

  private async recordFailedLogin(orgId: string, email: string, ip: string) {
    const recent = await this.prisma.auditLog.findMany({
      where: { orgId, action: 'AUTH_FAIL', createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) } },
    });
    await this.prisma.auditLog.create({ data: { orgId, action: 'AUTH_FAIL', resource: 'user', metadata: { email, ip } } });
    if (recent.length >= 4) {
      await this.prisma.alert.create({
        data: {
          orgId,
          type: 'FAILED_LOGIN_SPIKE',
          severity: 'HIGH',
          title: 'Excessive failed logins',
          description: `Multiple failed logins detected for ${email}`,
          timeline: { ip, count: recent.length + 1 },
        },
      });
    }
  }
}
