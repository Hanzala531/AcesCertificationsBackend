import crypto from 'crypto';

const SECRET = 'N4cR8uJ0yB3wE5aK9nX2rP6hS0dF4gJ8lC1mV5uR7tY0pQ9mT2vL6pZ1sH7k';
const ORG_ID = 'db74d948-6c13-4d2e-ad08-cbe1c72010b0';

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

async function testAPI(endpoint, description) {
  const url = `https://api.acescertification.org/api/search/organizations/${ORG_ID}${endpoint}`;

  console.log('='.repeat(80));
  console.log(`Testing: ${description}`);
  console.log('URL:', url);
  console.log('='.repeat(80));

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    const data = await response.json();
    
    if (data.payload) {
      const decrypted = decryptPayload(data.payload, SECRET);
      console.log(JSON.stringify(decrypted, null, 2));
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
    console.log('\n');
  } catch (error) {
    console.error('Error:', error.message);
    console.log('\n');
  }
}

async function runTests() {
  console.log('\n');
  console.log('Testing Organization APIs for ID:', ORG_ID);
  console.log('\n');

  // Test Metrics API
  await testAPI('/metrics', 'Organization Metrics API');

  // Test Branches API
  await testAPI('/branches?page=1&limit=10', 'Organization Branches API');
}

runTests();
