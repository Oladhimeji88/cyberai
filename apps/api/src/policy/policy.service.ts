import { Injectable } from '@nestjs/common';

@Injectable()
export class PolicyService {
  async allow(input: Record<string, unknown>): Promise<boolean> {
    try {
      const res = await fetch(`${process.env.OPA_URL || 'http://opa:8181'}/v1/data/authz/allow`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input }),
      });
      if (!res.ok) return false;
      const body = await res.json();
      return Boolean(body.result);
    } catch {
      return false;
    }
  }
}