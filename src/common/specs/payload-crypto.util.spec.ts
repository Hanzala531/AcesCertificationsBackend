import { PayloadCryptoUtil } from '../security/payload-crypto.util';

describe('PayloadCryptoUtil', () => {
  const originalEnabled = process.env.API_PAYLOAD_ENCRYPTION_ENABLED;
  const originalKey = process.env.API_PAYLOAD_ENCRYPTION_KEY;

  afterEach(() => {
    process.env.API_PAYLOAD_ENCRYPTION_ENABLED = originalEnabled;
    process.env.API_PAYLOAD_ENCRYPTION_KEY = originalKey;
  });

  it('encrypts and decrypts payload symmetrically', () => {
    process.env.API_PAYLOAD_ENCRYPTION_KEY = 'test-secret-key';

    const input = { hello: 'world', count: 7 };
    const encrypted = PayloadCryptoUtil.encrypt(input);
    const decrypted = PayloadCryptoUtil.decrypt<typeof input>(encrypted);

    expect(decrypted).toEqual(input);
  });

  it('throws for invalid payload format', () => {
    process.env.API_PAYLOAD_ENCRYPTION_KEY = 'test-secret-key';

    expect(() => PayloadCryptoUtil.decrypt('invalid-format')).toThrow(
      'Invalid encrypted payload format',
    );
  });

  it('reads encryption flag from env', () => {
    process.env.API_PAYLOAD_ENCRYPTION_ENABLED = 'true';
    expect(PayloadCryptoUtil.isEncryptionEnabled()).toBe(true);

    process.env.API_PAYLOAD_ENCRYPTION_ENABLED = 'false';
    expect(PayloadCryptoUtil.isEncryptionEnabled()).toBe(false);
  });
});
