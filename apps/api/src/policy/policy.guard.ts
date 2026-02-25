import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { POLICY_KEY } from './policy.decorator';
import { PolicyService } from './policy.service';

@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly policy: PolicyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.get<{ action: string; resource: string }>(POLICY_KEY, context.getHandler());
    if (!meta) return true;
    const req = context.switchToHttp().getRequest();
    const allowed = await this.policy.allow({
      user: req.user,
      action: meta.action,
      resource: meta.resource,
      orgId: req.user?.orgId,
      params: req.params,
      body: req.body,
    });
    if (!allowed) throw new ForbiddenException('Denied by policy');
    return true;
  }
}