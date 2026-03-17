// Wait for deploy, then test logins + data existence via API
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

async function waitForDeploy() {
  const initial = await httpRequest('GET', '/health');
  const initialUptime = initial.data?.uptime || 99999;
  console.log(`Current uptime: ${Math.round(initialUptime)}s — waiting for new deploy...`);
  for (let i = 0; i < 50; i++) {
    await new Promise(r => setTimeout(r, 15000));
    const check = await httpRequest('GET', '/health');
    if (check.status === 0) { process.stdout.write(' [deploying...]'); continue; }
    const uptime = check.data?.uptime || 99999;
    process.stdout.write(` [${Math.round(uptime)}s]`);
    if (uptime < initialUptime - 30) {
      console.log('\n\n  ✓ NEW DEPLOY DETECTED!\n');
      await new Promise(r => setTimeout(r, 10000)); // Wait for seed to complete
      return true;
    }
  }
  console.log('\n  Timeout.'); return false;
}

async function main() {
  console.log('\n━━━ Waiting for Render deploy ━━━\n');
  await waitForDeploy();

  // Test logins
  console.log('━━━ Login Tests ━━━\n');
  const logins = [
    { email: 'admin@vetcare.com', password: 'Admin@123', label: 'Admin' },
    { email: 'dr.james.carter@vetcare.com', password: 'Doctor@123', label: 'Vet-Carter' },
    { email: 'emily.davis@email.com', password: 'Owner@123', label: 'Owner-Emily' },
    { email: 'robert.chen@email.com', password: 'Owner@123', label: 'Owner-Robert' },
    { email: 'john.miller@greenpastures.com', password: 'Farmer@123', label: 'Farmer-John' },
    { email: 'maria.garcia@sunrisefarm.com', password: 'Farmer@123', label: 'Farmer-Maria' },
  ];

  const tokens = {};
  for (const cred of logins) {
    const r = await httpRequest('POST', '/auth/login', { email: cred.email, password: cred.password });
    if (r.status === 200 && r.data.success) {
      console.log(`  ✓ ${cred.label.padEnd(15)} → logged in (${r.data.data.user.role})`);
      tokens[cred.label] = r.data.data.token;
    } else {
      console.log(`  ✗ ${cred.label.padEnd(15)} → FAILED (${r.status})`);
    }
  }

  // Test data endpoints for Emily (pet owner)
  console.log('\n━━━ Data Tests (Emily - Pet Owner) ━━━\n');
  const emilyToken = tokens['Owner-Emily'];
  if (emilyToken) {
    const endpoints = [
      { path: '/animals', label: 'Animals (My Pets)' },
      { path: '/medical-records', label: 'Medical Records' },
      { path: '/consultations', label: 'Consultations' },
      { path: '/prescriptions', label: 'Prescriptions' },
      { path: '/bookings', label: 'Bookings' },
    ];
    for (const ep of endpoints) {
      const r = await httpRequest('GET', ep.path, null, emilyToken);
      let count = '?';
      if (r.data?.data) {
        if (Array.isArray(r.data.data)) count = r.data.data.length;
        else if (r.data.data.animals) count = r.data.data.animals.length;
        else if (r.data.data.records) count = r.data.data.records.length;
        else if (r.data.data.consultations) count = r.data.data.consultations.length;
        else if (r.data.data.prescriptions) count = r.data.data.prescriptions.length;
        else if (r.data.data.bookings) count = r.data.data.bookings.length;
        else if (r.data.data.total !== undefined) count = r.data.data.total;
        else count = JSON.stringify(Object.keys(r.data.data)).substring(0, 80);
      }
      const icon = (typeof count === 'number' && count > 0) ? '✓' : '⚠';
      console.log(`  ${icon} ${ep.label.padEnd(25)} → ${count} ${r.status !== 200 ? `(HTTP ${r.status})` : ''}`);
    }
  }

  // Test data for Carter (vet)
  console.log('\n━━━ Data Tests (Carter - Vet) ━━━\n');
  const carterToken = tokens['Vet-Carter'];
  if (carterToken) {
    const endpoints = [
      { path: '/consultations', label: 'Consultations' },
      { path: '/prescriptions', label: 'Prescriptions' },
      { path: '/schedule', label: 'Schedule' },
      { path: '/bookings', label: 'Bookings' },
    ];
    for (const ep of endpoints) {
      const r = await httpRequest('GET', ep.path, null, carterToken);
      let count = '?';
      if (r.data?.data) {
        if (Array.isArray(r.data.data)) count = r.data.data.length;
        else if (r.data.data.total !== undefined) count = r.data.data.total;
        else count = JSON.stringify(Object.keys(r.data.data)).substring(0, 80);
      }
      const icon = (typeof count === 'number' && count > 0) ? '✓' : '⚠';
      console.log(`  ${icon} ${ep.label.padEnd(25)} → ${count} ${r.status !== 200 ? `(HTTP ${r.status})` : ''}`);
    }
  }

  // Test farmer data 
  console.log('\n━━━ Data Tests (John - Farmer) ━━━\n');
  const farmerToken = tokens['Farmer-John'];
  if (farmerToken) {
    const endpoints = [
      { path: '/animals', label: 'Animals/Livestock' },
      { path: '/consultations', label: 'Consultations' },
    ];
    for (const ep of endpoints) {
      const r = await httpRequest('GET', ep.path, null, farmerToken);
      let count = '?';
      if (r.data?.data) {
        if (Array.isArray(r.data.data)) count = r.data.data.length;
        else if (r.data.data.animals) count = r.data.data.animals.length;
        else if (r.data.data.total !== undefined) count = r.data.data.total;
        else count = JSON.stringify(Object.keys(r.data.data)).substring(0, 80);
      }
      const icon = (typeof count === 'number' && count > 0) ? '✓' : '⚠';
      console.log(`  ${icon} ${ep.label.padEnd(25)} → ${count} ${r.status !== 200 ? `(HTTP ${r.status})` : ''}`);
    }
  }

  console.log('\n━━━ Done ━━━\n');
}

main();
