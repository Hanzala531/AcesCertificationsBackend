import crypto from 'crypto';

const SECRET = 'N4cR8uJ0yB3wE5aK9nX2rP6hS0dF4gJ8lC1mV5uR7tY0pQ9mT2vL6pZ1sH7k';

function fromBase64Url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  return Buffer.from(padded, 'base64');
}

function deriveAesKey(secret) {
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

function decryptPayload(payload, secret) {
  const parts = payload.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format');
  }

  const [ivB64, tagB64, ciphertextB64] = parts;
  const iv = fromBase64Url(ivB64);
  const tag = fromBase64Url(tagB64);
  const ciphertext = fromBase64Url(ciphertextB64);

  const key = deriveAesKey(secret);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return JSON.parse(decrypted.toString('utf8'));
}

async function testProductionAPI() {
  const orgId = 'db74d948-6c13-4d2e-ad08-cbe1c72010b0';
  const url = `https://api.acescertification.org/api/search/organizations/${orgId}/branches?page=1&limit=10`;

  console.log('Testing Production API...');
  console.log('URL:', url);
  console.log('');

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    const data = await response.json();
    
    if (data.payload) {
      console.log('Encrypted response received. Decrypting...\n');
      const decrypted = decryptPayload(data.payload, SECRET);
      console.log('Decrypted Response:');
      console.log(JSON.stringify(decrypted, null, 2));
    } else {
      console.log('Plain Response:');
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testProductionAPI();
