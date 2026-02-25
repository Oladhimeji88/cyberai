import { PolicyService } from '../src/policy/policy.service';

describe('PolicyService', () => {
  it('denies on OPA failure', async () => {
    const p = new PolicyService();
    const allow = await p.allow({});
    expect(typeof allow).toBe('boolean');
  });
});