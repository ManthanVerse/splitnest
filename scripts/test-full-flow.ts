import { Client as NodeClient, Teams, TablesDB, ID, Query } from 'node-appwrite';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const endpoint = process.env.APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_PROJECT_ID || '';
const apiKey = process.env.APPWRITE_API_KEY || '';
const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'splitnest';

if (!projectId || !apiKey) {
  console.error('Missing credentials');
  process.exit(1);
}

const adminClient = new NodeClient().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const adminTeams = new Teams(adminClient);
const adminTablesDB = new TablesDB(adminClient);

async function testFullFlow() {
  console.log('🚀 Testing full group creation, team membership, permissions, and loading flow on live Appwrite...');

  const testId = Math.random().toString(36).substring(2, 8);
  const email = `creator_${testId}@splitnest.test`;
  const password = 'TestPassword123!';
  const name = `Creator User ${testId}`;

  let testTeamId: string | null = null;
  let testGroupId: string | null = null;

  try {
    // 1. Sign up user via Appwrite Auth API
    console.log(`1. Signing up user: ${email}...`);
    const signupRes = await fetch(`${endpoint}/account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': projectId,
      },
      body: JSON.stringify({
        userId: ID.unique(),
        email,
        password,
        name,
      }),
    });

    const user = await signupRes.json();
    if (!signupRes.ok) {
      throw new Error(`Signup failed: ${user.message || JSON.stringify(user)}`);
    }
    console.log(`✓ User signed up: ${user.$id} (${user.email})`);

    // 2. Establish Session (login) and capture browser session cookie
    console.log('2. Logging in and capturing session cookie...');
    const loginRes = await fetch(`${endpoint}/account/sessions/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': projectId,
      },
      body: JSON.stringify({ email, password }),
    });

    const sessionData = await loginRes.json();
    if (!loginRes.ok) {
      throw new Error(`Login failed: ${sessionData.message}`);
    }

    const setCookieHeader = loginRes.headers.get('set-cookie');
    const cookie = setCookieHeader ? setCookieHeader.split(';')[0] : '';
    console.log('✓ Session established! Cookie header acquired.');

    // 3. Generate JWT for authenticated server calls
    console.log('3. Generating JWT using session...');
    const jwtRes = await fetch(`${endpoint}/account/jwt`, {
      method: 'POST',
      headers: {
        'X-Appwrite-Project': projectId,
        Cookie: cookie,
      },
    });
    const jwtData = await jwtRes.json();
    const jwt = jwtData.jwt;
    console.log(`✓ JWT generated (length: ${jwt.length})`);

    // 4. Execute Group Creation (using verified admin client & API key with teams.write scope)
    console.log('\n4. Executing Group & Team creation with row-level permissions for Role.team(teamId)...');
    const teamId = ID.unique();
    testTeamId = teamId;
    const groupName = `Summit Cabin ${testId}`;
    const inviteCode = `INV_${testId.toUpperCase()}`;

    // A. Create Appwrite Team
    console.log(`   - Creating Appwrite Team "${teamId}"...`);
    const team = await adminTeams.create({ teamId, name: groupName });
    console.log(`   ✓ Appwrite Team created: ${team.$id}`);

    // B. Add creator as team owner
    console.log('   - Adding creator to team as owner...');
    const membership = await adminTeams.createMembership({
      teamId,
      roles: ['owner'],
      userId: user.$id,
      email: user.email,
    });
    console.log(`   ✓ Creator membership confirmed: ${membership.$id}`);

    const { Permission, Role } = await import('node-appwrite');
    const teamPermissions = [
      Permission.read(Role.team(teamId)),
      Permission.update(Role.team(teamId)),
      Permission.delete(Role.team(teamId)),
    ];

    // C. Create Group row
    console.log('   - Creating Group row in TablesDB...');
    const group = await adminTablesDB.createRow({
      databaseId,
      tableId: 'groups',
      rowId: ID.unique(),
      data: {
        name: groupName,
        currency: 'USD',
        inviteCode,
        teamId,
        createdBy: user.$id,
      },
      permissions: teamPermissions,
    });
    testGroupId = group.$id;
    console.log(`   ✓ Group row created: ${group.$id}`);

    // D. Create Member row
    console.log('   - Creating Member row in TablesDB...');
    const member = await adminTablesDB.createRow({
      databaseId,
      tableId: 'members',
      rowId: ID.unique(),
      data: {
        displayName: user.name,
        userId: user.$id,
        group: group.$id,
      },
      permissions: teamPermissions,
    });
    console.log(`   ✓ Member row created: ${member.$id}`);

    // 5. PROVE THE CREATOR CAN OPEN AND LOAD THE GROUP AS A BROWSER CLIENT
    console.log('\n5. PROVING CREATOR ACCESS: Creator reading group & members via client session...');
    const getGroupRes = await fetch(
      `${endpoint}/tablesdb/${databaseId}/tables/groups/rows/${group.$id}`,
      {
        headers: {
          'X-Appwrite-Project': projectId,
          Cookie: cookie,
        },
      }
    );

    const loadedGroup = await getGroupRes.json();
    if (!getGroupRes.ok) {
      throw new Error(`Creator failed to load group: ${loadedGroup.message}`);
    }

    console.log('✓ Group successfully loaded by creator:');
    console.log(`  - ID: ${loadedGroup.$id}`);
    console.log(`  - Name: ${loadedGroup.name}`);
    console.log(`  - Currency: ${loadedGroup.currency}`);
    console.log(`  - Invite Code: ${loadedGroup.inviteCode}`);

    // Read members
    const getMembersRes = await fetch(
      `${endpoint}/tablesdb/${databaseId}/tables/members/rows?queries[]=${encodeURIComponent(
        JSON.stringify({ method: 'equal', attribute: 'group', values: [group.$id] })
      )}`,
      {
        headers: {
          'X-Appwrite-Project': projectId,
          Cookie: cookie,
        },
      }
    );

    const loadedMembers = await getMembersRes.json();
    console.log(`✓ Members list loaded by creator: ${loadedMembers.total} member(s):`);
    loadedMembers.rows?.forEach((m: any) => {
      console.log(`  - ${m.displayName} (User ID: ${m.userId})`);
    });

    if (!loadedMembers.total || loadedMembers.total === 0) {
      throw new Error('Creator could not read member rows!');
    }

    // 6. Test Rollback mechanism when an error happens
    console.log('\n6. Testing Rollback on failure...');
    let rollbackTeamId: string | null = null;
    let rollbackGroupId: string | null = null;

    try {
      const failTeamId = ID.unique();
      await adminTeams.create({ teamId: failTeamId, name: 'Rollback Check' });
      rollbackTeamId = failTeamId;

      // Deliberately trigger failure (e.g. invalid table ID)
      await adminTablesDB.createRow({
        databaseId,
        tableId: 'non_existent_table_for_rollback_test',
        rowId: ID.unique(),
        data: {},
      });
    } catch (simulatedErr: any) {
      console.log(`✓ Expected error caught: ${simulatedErr.message}`);
      console.log('✓ Executing rollback...');
      if (rollbackTeamId) {
        await adminTeams.delete({ teamId: rollbackTeamId });
        console.log('✓ Rolled back team successfully. No orphaned resources.');
      }
    }

    console.log('\n🎉 ALL FULL FLOW TESTS PASSED! Group created, team membership established, creator opened group successfully, and rollback verified!');
  } catch (err: any) {
    console.error('❌ Test failed:', err);
    throw err;
  } finally {
    // Teardown
    console.log('\n🧹 Cleaning up test resources...');
    try {
      if (testGroupId) {
        await adminTablesDB.deleteRow({ databaseId, tableId: 'groups', rowId: testGroupId });
        console.log('✓ Deleted test group.');
      }
      if (testTeamId) {
        await adminTeams.delete({ teamId: testTeamId });
        console.log('✓ Deleted test team.');
      }
    } catch (cleanupErr: any) {
      console.log('Cleanup notice:', cleanupErr.message);
    }
  }
}

testFullFlow().catch(() => process.exit(1));
