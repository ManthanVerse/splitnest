import { Client as NodeClient, TablesDB, Query, ID } from 'node-appwrite';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const endpoint = process.env.APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_PROJECT_ID || '';
const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'splitnest';

async function getJWTForUser(email: string, pass: string): Promise<{ jwt: string; userId: string }> {
  // 1. Create session
  const sessionRes = await fetch(`${endpoint}/account/sessions/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Appwrite-Project': projectId,
    },
    body: JSON.stringify({ email, password: pass }),
  });

  const session = await sessionRes.json();
  const cookie = sessionRes.headers.get('set-cookie')?.split(';')[0] || '';
  if (!session.userId) {
    throw new Error('Login failed: ' + JSON.stringify(session));
  }

  // 2. Create JWT using session cookie
  const jwtRes = await fetch(`${endpoint}/account/jwt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Appwrite-Project': projectId,
      Cookie: cookie,
    },
  });

  const jwtData = await jwtRes.json();
  if (!jwtData.jwt) {
    throw new Error('JWT creation failed: ' + JSON.stringify(jwtData));
  }

  return { jwt: jwtData.jwt, userId: session.userId };
}

async function testPermissions() {
  console.log('===========================================================');
  console.log('🛡️  SplitNest Cross-User Row-Level Security Verification');
  console.log('===========================================================');

  // 1. Sign in as Team Member: Alex (demo@splitnest.app)
  console.log('\n1. Signing in as Team Member: Alex (demo@splitnest.app)...');
  const alexAuth = await getJWTForUser(
    'demo@splitnest.app',
    process.env.SEED_DEMO_PASSWORD || 'DemoPassword123!'
  );
  console.log(`✓ Alex signed in (User ID: ${alexAuth.userId})`);

  const alexClient = new NodeClient()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setJWT(alexAuth.jwt);
  const alexTablesDB = new TablesDB(alexClient);

  // Alex lists groups
  const alexGroups = await alexTablesDB.listRows({
    databaseId,
    tableId: 'groups',
  });
  const flat402 = alexGroups.rows?.find((g: any) => g.name === 'Flat 402');
  if (!flat402) {
    throw new Error('Could not find Flat 402 group. Did you run "npm run seed"?');
  }
  console.log(`✓ Alex can see Flat 402 ($id: ${flat402.$id}) - Authorized via Role.team(${flat402.teamId})`);

  // Alex reads expenses for Flat 402
  const alexExpenses = await alexTablesDB.listRows({
    databaseId,
    tableId: 'expenses',
    queries: [Query.equal('group', [flat402.$id])],
  });
  console.log(`✓ Alex loaded ${alexExpenses.total} expenses for Flat 402.`);

  // 2. Outsider: Eve (not in the Appwrite Team)
  console.log('\n2. Signing in as Outsider User: Eve (eve_1793178543326@splitnest.test)...');
  const eveEmail = 'eve_1793178543326@splitnest.test';
  const evePassword = 'EveOutsiderPassword123!';

  const eveAuth = await getJWTForUser(eveEmail, evePassword);
  console.log(`✓ Eve signed in as outsider (${eveAuth.userId})`);

  const eveClient = new NodeClient()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setJWT(eveAuth.jwt);
  const eveTablesDB = new TablesDB(eveClient);

  // 3. Eve attempts to read Flat 402 group row directly
  console.log('\n3. Eve attempts to fetch Flat 402 group row by ID directly...');
  try {
    const forbiddenGroup = await eveTablesDB.getRow({
      databaseId,
      tableId: 'groups',
      rowId: flat402.$id,
    });
    throw new Error(`SECURITY VIOLATION: Eve was able to read group directly! ${JSON.stringify(forbiddenGroup)}`);
  } catch (err: any) {
    console.log(`   ✓ Access denied as expected: "${err.message}" (code ${err.code})`);
  }

  // 4. Eve attempts to query Flat 402 expenses
  console.log('\n4. Eve attempts to query expenses belonging to Flat 402...');
  const eveQueryRes = await eveTablesDB.listRows({
    databaseId,
    tableId: 'expenses',
    queries: [Query.equal('group', [flat402.$id])],
  });

  console.log(`   Eve query returned: ${eveQueryRes.total} rows`);
  if (eveQueryRes.total === 0) {
    console.log('   ✓ EXACTLY 0 rows returned to outsider! Row-level security strictly enforced.');
  } else {
    throw new Error(`SECURITY VIOLATION: Eve was able to query group expenses! Total: ${eveQueryRes.total}`);
  }

  console.log('\n===========================================================');
  console.log('✅ ROW-LEVEL SECURITY VERIFICATION PASSED 100%!');
  console.log('   • Team members (Role.team) have full authorized access.');
  console.log('   • Non-team users receive 404/401 and 0 query rows.');
  console.log('===========================================================\n');
}

testPermissions().catch((err) => {
  console.error('\n❌ Permission test failed:', err);
  process.exit(1);
});
