const axios = require('axios');
(async () => {
  const { data: login } = await axios.post('http://localhost:3001/api/auth/login', {
    email: 'admin@example.com',
    password: 'SecurePassword123!',
  });
  console.log('LOGIN response keys:', Object.keys(login));
  console.log(JSON.stringify(login, null, 2).slice(0, 2000));
})().catch((e) => {
  console.error('FAIL', e.response?.status, e.response?.data || e.message);
  process.exit(1);
});
