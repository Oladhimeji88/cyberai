import { CryptoService } from '../src/common/crypto.service';

describe('CryptoService', () => {
  const svc = new CryptoService();

  it('encrypts/decrypts with envelope', async () => {
    const kek = await svc.deriveKek('root', 'salt');
    const payload = svc.envelopeEncrypt('hello', kek);
    const out = svc.envelopeDecrypt(payload, kek);
    expect(out).toBe('hello');
  });
});