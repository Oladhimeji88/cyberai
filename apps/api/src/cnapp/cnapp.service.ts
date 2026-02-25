import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as AWS from 'aws-sdk';

@Injectable()
export class CnappService {
  constructor(private readonly prisma: PrismaService) {}

  async runScan(orgId: string) {
    const findings: any[] = [];

    const org = await this.prisma.org.findUnique({ where: { id: orgId } });
    const roleArn = org?.awsRoleArn || process.env.AWS_ROLE_ARN;
    let credentials: AWS.Credentials | undefined;
    if (roleArn) {
      const sts = new AWS.STS({ region: process.env.AWS_REGION || 'us-east-1' });
      const assumed = await sts.assumeRole({
        RoleArn: roleArn,
        RoleSessionName: `scan-${Date.now()}`,
        ExternalId: org?.awsExternalId || process.env.AWS_EXTERNAL_ID,
      }).promise();
      credentials = new AWS.Credentials({
        accessKeyId: assumed.Credentials!.AccessKeyId!,
        secretAccessKey: assumed.Credentials!.SecretAccessKey!,
        sessionToken: assumed.Credentials!.SessionToken,
      });
    }

    const region = process.env.AWS_REGION || 'us-east-1';
    const s3 = new AWS.S3({ region, credentials });
    const ec2 = new AWS.EC2({ region, credentials });
    const iam = new AWS.IAM({ region, credentials });
    const cloudtrail = new AWS.CloudTrail({ region, credentials });

    try {
      const buckets = await s3.listBuckets().promise();
      for (const b of buckets.Buckets || []) {
        if (!b.Name) continue;
        try {
          const acl = await s3.getBucketAcl({ Bucket: b.Name }).promise();
          const publicGrant = (acl.Grants || []).some((g) => String(g.Grantee?.URI || '').includes('AllUsers'));
          if (publicGrant) {
            findings.push({ checkId: 'AWS_S3_PUBLIC', title: 'Public S3 bucket', severity: 'HIGH', resource: b.Name, remediation: 'Remove public ACL grants.' });
          }
        } catch {}
      }
    } catch {}

    try {
      const sgs = await ec2.describeSecurityGroups().promise();
      for (const sg of sgs.SecurityGroups || []) {
        for (const perm of sg.IpPermissions || []) {
          const open = (perm.IpRanges || []).some((r) => r.CidrIp === '0.0.0.0/0');
          const port = perm.FromPort || 0;
          if (open && [22, 3389, 3306, 5432].includes(port)) {
            findings.push({ checkId: 'AWS_SG_OPEN_SENSITIVE', title: 'Sensitive port open to internet', severity: 'CRITICAL', resource: sg.GroupId, remediation: 'Restrict CIDR ranges for sensitive ports.' });
          }
        }
      }
    } catch {}

    try {
      const users = await iam.listUsers().promise();
      for (const user of users.Users || []) {
        const keys = await iam.listAccessKeys({ UserName: user.UserName! }).promise();
        for (const key of keys.AccessKeyMetadata || []) {
          const age = (Date.now() - new Date(key.CreateDate!).getTime()) / (1000 * 60 * 60 * 24);
          if (age > Number(process.env.AWS_KEY_MAX_AGE_DAYS || 90)) {
            findings.push({ checkId: 'AWS_IAM_OLD_KEYS', title: 'Stale IAM access key', severity: 'MEDIUM', resource: `${user.UserName}:${key.AccessKeyId}`, remediation: 'Rotate IAM access key.' });
          }
        }
      }
    } catch {}

    try {
      const summary = await iam.getAccountSummary().promise();
      const mfa = summary.SummaryMap?.AccountMFAEnabled;
      if (mfa === 0) {
        findings.push({ checkId: 'AWS_ROOT_MFA_DISABLED', title: 'Root MFA disabled', severity: 'CRITICAL', resource: 'account-root', remediation: 'Enable root account MFA.' });
      }
    } catch {}

    try {
      const trails = await cloudtrail.describeTrails().promise();
      if (!trails.trailList?.length) {
        findings.push({ checkId: 'AWS_CLOUDTRAIL_DISABLED', title: 'CloudTrail not enabled', severity: 'HIGH', resource: 'account', remediation: 'Enable CloudTrail in all regions.' });
      }
    } catch {}

    const created = await Promise.all(
      findings.map((f) =>
        this.prisma.finding.create({
          data: {
            orgId,
            source: 'CSPM',
            checkId: f.checkId,
            title: f.title,
            severity: f.severity,
            resource: f.resource || 'unknown',
            status: 'OPEN',
            remediation: f.remediation,
            metadata: {},
          },
        }),
      ),
    );

    const score = Math.max(0, 100 - findings.length * 10);
    await this.prisma.postureRun.create({
      data: { orgId, provider: 'AWS', score, summary: { findings: findings.length } },
    });

    return { score, findings: created };
  }

  async ingestRuntime(orgId: string, payload: any) {
    const suspiciousBins = ['nc', 'netcat', 'nmap', 'curl'];
    const unusualPorts = [4444, 1337, 31337];

    const runtimeFindings: any[] = [];
    if (payload.type === 'process_start' && suspiciousBins.includes(payload.process)) {
      runtimeFindings.push({ checkId: 'RUNTIME_SUSPICIOUS_BINARY', title: 'Suspicious binary started', severity: 'HIGH', resource: payload.hostname, remediation: 'Investigate process and terminate if malicious.', metadata: payload });
    }

    if (payload.type === 'net_conn' && unusualPorts.includes(Number(payload.port))) {
      runtimeFindings.push({ checkId: 'RUNTIME_UNUSUAL_PORT', title: 'Connection to unusual port', severity: 'MEDIUM', resource: payload.hostname, remediation: 'Validate egress policy and destination.', metadata: payload });
    }

    return Promise.all(runtimeFindings.map((f) => this.prisma.finding.create({
      data: {
        orgId,
        source: 'RUNTIME',
        checkId: f.checkId,
        title: f.title,
        severity: f.severity,
        resource: f.resource,
        status: 'OPEN',
        remediation: f.remediation,
        metadata: f.metadata,
      },
    })));
  }
}
