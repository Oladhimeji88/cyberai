import * as crypto from 'crypto';
import * as argon2 from 'argon2';

export type EnvelopePayload = {
  encryptedDek: string;
  ciphertext: string;
  nonce: string;
  tag: string;
};

export class CryptoService {
  async deriveKek(rootSecret: string, salt: string): Promise<Buffer> {
    const hash = await argon2.hash(rootSecret + salt, {
      type: argon2.argon2id,
      timeCost: 3,
      memoryCost: 65536,
      parallelism: 1,
      hashLength: 32,
      raw: true,
    });
    return Buffer.from(hash);
  }

  async verifyRootSecret(rootSecret: string, salt: string, verifier: string): Promise<boolean> {
    return argon2.verify(verifier, rootSecret + salt);
  }

  async createRootVerifier(rootSecret: string, salt: string): Promise<string> {
    return argon2.hash(rootSecret + salt, { type: argon2.argon2id });
  }

  envelopeEncrypt(plaintext: string, kek: Buffer): EnvelopePayload {
    const dek = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    const dekIv = crypto.randomBytes(12);
    const dekCipher = crypto.createCipheriv('aes-256-gcm', kek, dekIv);
    const encryptedDek = Buffer.concat([dekCipher.update(dek), dekCipher.final()]);
    const dekTag = dekCipher.getAuthTag();

    return {
      encryptedDek: Buffer.concat([dekIv, dekTag, encryptedDek]).toString('base64'),
      ciphertext: ciphertext.toString('base64'),
      nonce: iv.toString('base64'),
      tag: tag.toString('base64'),
    };
  }

  envelopeDecrypt(payload: EnvelopePayload, kek: Buffer): string {
    const dekBundle = Buffer.from(payload.encryptedDek, 'base64');
    const dekIv = dekBundle.subarray(0, 12);
    const dekTag = dekBundle.subarray(12, 28);
    const encryptedDek = dekBundle.subarray(28);

    const dekDecipher = crypto.createDecipheriv('aes-256-gcm', kek, dekIv);
    dekDecipher.setAuthTag(dekTag);
    const dek = Buffer.concat([dekDecipher.update(encryptedDek), dekDecipher.final()]);

    const decipher = crypto.createDecipheriv('aes-256-gcm', dek, Buffer.from(payload.nonce, 'base64'));
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, 'base64')), decipher.final()]);
    return plaintext.toString('utf8');
  }
}