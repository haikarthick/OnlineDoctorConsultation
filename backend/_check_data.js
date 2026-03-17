// Check what tables have data in the database via the admin API
const https = require('https');
const BASE = 'https://vetcare-dev.onrender.com/api/v1';

function httpRequest(method, path, data, token) {
  return new Promise((resolve) => {
    const url = new URL(BASE + path);
    const body = data ? JSON.stringify(data) : null;
    const options = {
      hostname: url.hostname, port: 443, path: url.pathname + (url.search || ''),
      method, headers: { 'Content-Type': 'application/json' },
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    if (body) options.headers['Content-Length'] = Buffer.byteLength(body);
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', (e) => resolve({ status: 0, data: { error: e.message } }));
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  // Login as admin
  const login = await httpRequest('POST', '/auth/login', { email: 'admin@vetcare.com', password: 'Admin@123' });
  if (login.status !== 200) { console.log('Admin login failed'); return; }
  const token = login.data.data.token;
  console.log('Admin logged in\n');

  // Check users
  const users = await httpRequest('GET', '/admin/users?page=1&limit=50', null, token);
  if (users.status === 200 && users.data.data) {
    const userList = users.data.data.users || users.data.data;
    if (Array.isArray(userList)) {
      console.log(`Users (${userList.length}):`);
      userList.forEach(u => console.log(`  - ${u.email} (${u.role}) active=${u.isActive}`));
    } else {
      console.log('Users response:', JSON.stringify(users.data.data).substring(0, 300));
    }
  } else {
    console.log('Users endpoint:', users.status, JSON.stringify(users.data).substring(0, 200));
  }

  // Check animals as Emily
  const emilyLogin = await httpRequest('POST', '/auth/login', { email: 'emily.davis@email.com', password: 'Owner@123' });
  const emilyToken = emilyLogin.data.data.token;
  
  // Try different animal endpoint patterns
  console.log('\nAnimal endpoints:');
  for (const path of ['/animals', '/animals?page=1', '/animals/my', '/pets']) {
    const r = await httpRequest('GET', path, null, emilyToken);
    console.log(`  GET ${path} → ${r.status}: ${JSON.stringify(r.data).substring(0, 150)}`);
  }

  // Check system settings
  console.log('\nSystem check:');
  const health = await httpRequest('GET', '/health');
  console.log(`  Health: uptime=${Math.round(health.data.uptime)}s`);
  
  // Try admin dashboard stats
  const stats = await httpRequest('GET', '/admin/dashboard', null, token);
  console.log(`  Admin dashboard: ${stats.status} ${JSON.stringify(stats.data).substring(0, 300)}`);
}

main().catch(console.error);
