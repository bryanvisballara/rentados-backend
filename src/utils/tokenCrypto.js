const crypto = require('crypto');

function getKey() {
  const secret = process.env.GMAIL_TOKEN_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET o GMAIL_TOKEN_SECRET requerida para cifrar tokens de Gmail');
  return crypto.createHash('sha256').update(String(secret)).digest();
}

function encryptSecret(plain) {
  if (!plain) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decryptSecret(payload) {
  if (!payload) return '';
  const [ivB64, tagB64, dataB64] = String(payload).split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Token cifrado inválido');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64url')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

module.exports = { encryptSecret, decryptSecret };
