import { SetMetadata } from '@nestjs/common';

export const POLICY_KEY = 'policy_key';
export const RequirePolicy = (action: string, resource: string) => SetMetadata(POLICY_KEY, { action, resource });