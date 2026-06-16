const axios = require('axios');
(async () => {
  const { data: login } = await axios.post('http://localhost:3001/api/auth/login', {
    email: 'admin@example.com', password: 'SecurePassword123!',
  });
  const token = login?.tokens?.access_token;
  const client = axios.create({
    baseURL: 'http://localhost:3001/api',
    headers: { Authorization: `Bearer ${token}` },
    timeout: 30000,
  });
  // List all certs
  const { data } = await client.get('/certificates?page=1&limit=100');
  const root = data?.data?.data || data?.data || [];
  const certs = Array.isArray(root) ? root : root.certificates || [];
  console.log(`Total certificates: ${certs.length}`);
  for (const c of certs) {
    console.log(
      `  ${c.id}  |  pub=${c.is_published}  |  ${c.name}  |  ${c.certificate_id || '?'}  |  ${(c.description || '').slice(0, 60)}`,
    );
  }
})().catch((e) => {
  console.error('FAIL', e.response?.status, JSON.stringify(e.response?.data || e.message));
  process.exit(1);
});
