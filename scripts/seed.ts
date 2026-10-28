import {
  Client as NodeClient,
  Teams,
  TablesDB,
  Users,
  ID,
  Query,
  Permission,
  Role,
} from 'node-appwrite';
import * as dotenv from 'dotenv';
import * as path from 'path';
import {
  calculateEqualSplits,
  calculateBalances,
  calculateMinimalSettlements,
  calculateNaiveTransferCount,
  formatCurrency,
} from '../src/lib/split-engine';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const endpoint = process.env.APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_PROJECT_ID || '';
const apiKey = process.env.APPWRITE_API_KEY || '';
const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'splitnest';
const demoPassword = process.env.SEED_DEMO_PASSWORD || 'DemoPassword123!';

if (!projectId || !apiKey) {
  console.error('❌ Missing APPWRITE_PROJECT_ID or APPWRITE_API_KEY in .env.local');
  process.exit(1);
}

const client = new NodeClient().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const teams = new Teams(client);
const tablesDB = new TablesDB(client);
const users = new Users(client);

interface DemoUserDef {
  name: string;
  email: string;
}

const DEMO_USERS: DemoUserDef[] = [
  { name: 'Alex (Demo Creator)', email: 'demo@splitnest.app' },
  { name: 'Sam Rivera', email: 'sam@splitnest.app' },
  { name: 'Jordan Lee', email: 'jordan@splitnest.app' },
  { name: 'Taylor Kim', email: 'taylor@splitnest.app' },
];

async function getOrCreateUser(def: DemoUserDef): Promise<{ $id: string; name: string; email: string }> {
  // 1. Try to sign up via public Appwrite Auth endpoint
  try {
    const signupRes = await fetch(`${endpoint}/account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': projectId,
      },
      body: JSON.stringify({
        userId: ID.unique(),
        email: def.email,
        password: demoPassword,
        name: def.name,
      }),
    });

    const data = await signupRes.json();
    if (signupRes.ok && data.$id) {
      console.log(`  + Created user: ${def.email} (${data.$id})`);
      return { $id: data.$id, name: def.name, email: def.email };
    }

    // 2. If user already exists (HTTP 409), log in to retrieve userId
    if (signupRes.status === 409) {
      const loginRes = await fetch(`${endpoint}/account/sessions/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Appwrite-Project': projectId,
        },
        body: JSON.stringify({
          email: def.email,
          password: demoPassword,
        }),
      });

      const session = await loginRes.json();
      if (loginRes.ok && session.userId) {
        console.log(`  ✓ Found existing user: ${def.email} (${session.userId})`);
        return { $id: session.userId, name: def.name, email: def.email };
      }
    }

    throw new Error(`Failed to ensure user ${def.email}: ${data.message || JSON.stringify(data)}`);
  } catch (err: any) {
    throw new Error(`Auth error for ${def.email}: ${err.message}`);
  }
}

async function seed() {
  console.log('===========================================================');
  console.log('🌱 SplitNest Realistic Demo Seed Script (Appwrite TablesDB)');
  console.log('===========================================================');
  console.log(`Endpoint:   ${endpoint}`);
  console.log(`Project ID: ${projectId}`);
  console.log(`Database:   ${databaseId}\n`);

  // 1. Ensure all 4 demo users exist
  console.log('1. Ensuring demo user accounts...');
  const userMap: Record<string, { $id: string; name: string; email: string }> = {};
  for (const def of DEMO_USERS) {
    const u = await getOrCreateUser(def);
    userMap[def.email] = u;
  }

  const alexUser = userMap['demo@splitnest.app'];
  const samUser = userMap['sam@splitnest.app'];
  const jordanUser = userMap['jordan@splitnest.app'];
  const taylorUser = userMap['taylor@splitnest.app'];

  // 2. Cleanup previous demo group "Flat 402" if exists (Idempotence)
  console.log('\n2. Cleaning up any previous "Flat 402" demo group for clean re-seed...');
  try {
    const existingGroups = await tablesDB.listRows({
      databaseId,
      tableId: 'groups',
      queries: [Query.equal('name', ['Flat 402']), Query.limit(10)],
    });

    for (const g of existingGroups.rows) {
      console.log(`  - Removing old demo group: ${g.$id} (Team: ${g.teamId})...`);

      // 1. Delete splits and expenses
      try {
        const exps = await tablesDB.listRows({
          databaseId,
          tableId: 'expenses',
          queries: [Query.equal('group', [g.$id]), Query.limit(100)],
        });
        for (const exp of exps.rows) {
          const sps = await tablesDB.listRows({
            databaseId,
            tableId: 'splits',
            queries: [Query.equal('expense', [exp.$id]), Query.limit(100)],
          });
          for (const sp of sps.rows) {
            await tablesDB.deleteRow({ databaseId, tableId: 'splits', rowId: sp.$id }).catch(() => {});
          }
          await tablesDB.deleteRow({ databaseId, tableId: 'expenses', rowId: exp.$id }).catch(() => {});
        }
      } catch (err: any) {
        console.warn('    Note deleting expenses/splits:', err.message);
      }

      // 2. Delete settlements
      try {
        const sts = await tablesDB.listRows({
          databaseId,
          tableId: 'settlements',
          queries: [Query.equal('group', [g.$id]), Query.limit(100)],
        });
        for (const st of sts.rows) {
          await tablesDB.deleteRow({ databaseId, tableId: 'settlements', rowId: st.$id }).catch(() => {});
        }
      } catch (err: any) {
        console.warn('    Note deleting settlements:', err.message);
      }

      // 3. Delete members
      try {
        const mems = await tablesDB.listRows({
          databaseId,
          tableId: 'members',
          queries: [Query.equal('group', [g.$id]), Query.limit(100)],
        });
        for (const m of mems.rows) {
          await tablesDB.deleteRow({ databaseId, tableId: 'members', rowId: m.$id }).catch(() => {});
        }
      } catch (err: any) {
        console.warn('    Note deleting members:', err.message);
      }

      // 4. Delete group row
      try {
        await tablesDB.deleteRow({ databaseId, tableId: 'groups', rowId: g.$id });
        console.log(`  ✓ Old demo group row deleted: ${g.$id}`);
      } catch (err: any) {
        console.warn('    Note deleting group row:', err.message);
      }

      // 5. Delete team
      try {
        if (g.teamId) await teams.delete({ teamId: g.teamId });
        console.log(`  ✓ Old demo team deleted: ${g.teamId}`);
      } catch (err: any) {
        console.warn('    Note deleting team:', err.message);
      }
    }
  } catch (err: any) {
    console.warn('  Note checking existing groups:', err.message);
  }

  // 3. Create Appwrite Team for Flat 402
  console.log('\n3. Creating Appwrite Team for "Flat 402"...');
  const team = await teams.create({
    teamId: ID.unique(),
    name: 'Flat 402',
  });
  const teamId = team.$id;
  console.log(`  ✓ Created isolated Appwrite Team: ${teamId}`);

  // Add all 4 roommates to the team
  for (const def of DEMO_USERS) {
    const u = userMap[def.email];
    await teams.createMembership({
      teamId,
      roles: ['member'],
      userId: u.$id,
      email: u.email,
    });
    console.log(`  ✓ Added ${def.name} (${u.$id}) to team ${teamId}`);
  }

  // 4. Create Group Row in TablesDB with Team Row Permissions
  console.log('\n4. Creating Group row in "groups" table...');
  const inviteCode = 'FLAT402X';
  const groupRow = await tablesDB.createRow({
    databaseId,
    tableId: 'groups',
    rowId: ID.unique(),
    data: {
      name: 'Flat 402',
      currency: 'USD',
      inviteCode,
      teamId,
      createdBy: alexUser.$id,
    },
    permissions: [
      Permission.read(Role.team(teamId)),
      Permission.update(Role.team(teamId)),
      Permission.delete(Role.team(teamId)),
    ],
  });
  const groupId = groupRow.$id;
  console.log(`  ✓ Created group: ${groupRow.name} ($id: ${groupId}, inviteCode: ${inviteCode})`);

  // 5. Create Member Rows for each roommate
  console.log('\n5. Creating Member rows with ManyToOne relationship to group...');
  const memberRows: Record<string, any> = {};

  const roommates = [
    { key: 'alex', user: alexUser, displayName: 'Alex' },
    { key: 'sam', user: samUser, displayName: 'Sam' },
    { key: 'jordan', user: jordanUser, displayName: 'Jordan' },
    { key: 'taylor', user: taylorUser, displayName: 'Taylor' },
  ];

  for (const r of roommates) {
    const mRow = await tablesDB.createRow({
      databaseId,
      tableId: 'members',
      rowId: ID.unique(),
      data: {
        displayName: r.displayName,
        userId: r.user.$id,
        group: groupId,
      },
      permissions: [
        Permission.read(Role.team(teamId)),
        Permission.update(Role.team(teamId)),
        Permission.delete(Role.team(teamId)),
      ],
    });
    memberRows[r.key] = mRow;
    console.log(`  ✓ Created member row: ${r.displayName} (${mRow.$id})`);
  }

  const alexMemberId = memberRows['alex'].$id;
  const samMemberId = memberRows['sam'].$id;
  const jordanMemberId = memberRows['jordan'].$id;
  const taylorMemberId = memberRows['taylor'].$id;
  const allMemberIds = [alexMemberId, samMemberId, jordanMemberId, taylorMemberId];

  // 6. Seed Realistic Expenses & Splits using Multi-Row Transactions
  console.log('\n6. Staging 18 realistic expenses across 8 weeks via TablesDB transactions...');

  const expensesData = [
    {
      desc: 'Apartment Monthly Rent - September',
      amountMinor: 280000,
      category: 'rent',
      date: '2026-09-01T12:00:00.000Z',
      payerId: alexMemberId,
      splitType: 'custom',
      splits: [
        { memberId: alexMemberId, shareMinor: 75000 },
        { memberId: samMemberId, shareMinor: 75000 },
        { memberId: jordanMemberId, shareMinor: 70000 },
        { memberId: taylorMemberId, shareMinor: 60000 },
      ],
    },
    {
      desc: "Weekly Groceries at Trader Joe's",
      amountMinor: 16420,
      category: 'groceries',
      date: '2026-09-04T16:30:00.000Z',
      payerId: alexMemberId,
      splitType: 'equal',
    },
    {
      desc: 'City Electric Utility Bill',
      amountMinor: 14250,
      category: 'utilities',
      date: '2026-09-07T10:15:00.000Z',
      payerId: samMemberId,
      splitType: 'equal',
    },
    {
      desc: 'Gigabit Fiber Internet Bill',
      amountMinor: 7999,
      category: 'utilities',
      date: '2026-09-10T09:00:00.000Z',
      payerId: jordanMemberId,
      splitType: 'equal',
    },
    {
      desc: 'Costco Bulk Household Restock',
      amountMinor: 24580,
      category: 'groceries',
      date: '2026-09-14T14:45:00.000Z',
      payerId: taylorMemberId,
      splitType: 'equal',
    },
    {
      desc: 'Living Room 55" Smart TV 4K',
      amountMinor: 48000,
      category: 'entertainment',
      date: '2026-09-18T19:20:00.000Z',
      payerId: samMemberId,
      splitType: 'equal',
    },
    {
      desc: 'Artisan Pizza Night Takeout',
      amountMinor: 6840,
      category: 'food',
      date: '2026-09-22T20:10:00.000Z',
      payerId: jordanMemberId,
      splitType: 'custom',
      splits: [
        { memberId: alexMemberId, shareMinor: 2000 },
        { memberId: samMemberId, shareMinor: 2000 },
        { memberId: jordanMemberId, shareMinor: 1840 },
        { memberId: taylorMemberId, shareMinor: 1000 },
      ],
    },
    {
      desc: 'Cleaning Supplies & Dyson Vacuum Filters',
      amountMinor: 5412,
      category: 'other',
      date: '2026-09-25T11:30:00.000Z',
      payerId: alexMemberId,
      splitType: 'equal',
    },
    {
      desc: 'Dishwasher Pods & Heavy-Duty Trash Bags',
      amountMinor: 3285,
      category: 'other',
      date: '2026-09-28T17:15:00.000Z',
      payerId: taylorMemberId,
      splitType: 'equal',
    },
    {
      desc: 'Apartment Monthly Rent - October',
      amountMinor: 280000,
      category: 'rent',
      date: '2026-10-01T12:00:00.000Z',
      payerId: alexMemberId,
      splitType: 'custom',
      splits: [
        { memberId: alexMemberId, shareMinor: 75000 },
        { memberId: samMemberId, shareMinor: 75000 },
        { memberId: jordanMemberId, shareMinor: 70000 },
        { memberId: taylorMemberId, shareMinor: 60000 },
      ],
    },
    {
      desc: 'Weekend Road Trip Gas Fill-up',
      amountMinor: 6500,
      category: 'travel',
      date: '2026-10-04T08:30:00.000Z',
      payerId: samMemberId,
      splitType: 'equal',
    },
    {
      desc: 'Lake Tahoe Cabin Airbnb 2-Night Stay',
      amountMinor: 52000,
      category: 'travel',
      date: '2026-10-06T15:00:00.000Z',
      payerId: alexMemberId,
      splitType: 'equal',
    },
    {
      desc: 'Espresso Coffee Beans & Fresh Bagels',
      amountMinor: 3850,
      category: 'food',
      date: '2026-10-10T09:45:00.000Z',
      payerId: jordanMemberId,
      splitType: 'equal',
    },
    {
      desc: 'Water & Sewage Quarterly Bill',
      amountMinor: 9530,
      category: 'utilities',
      date: '2026-10-12T13:20:00.000Z',
      payerId: samMemberId,
      splitType: 'equal',
    },
    {
      desc: 'Kitchen Dual-Zone Air Fryer',
      amountMinor: 8999,
      category: 'other',
      date: '2026-10-14T18:00:00.000Z',
      payerId: taylorMemberId,
      splitType: 'equal',
    },
    {
      desc: 'Board Game Night & Snack Platter',
      amountMinor: 4215,
      category: 'entertainment',
      date: '2026-10-17T21:00:00.000Z',
      payerId: alexMemberId,
      splitType: 'equal',
    },
    {
      desc: 'Emergency Plumber Kitchen Sink Clearing',
      amountMinor: 18000,
      category: 'other',
      date: '2026-10-21T14:10:00.000Z',
      payerId: alexMemberId,
      splitType: 'equal',
    },
    {
      desc: 'Group Dinner at Osteria Italian',
      amountMinor: 21050,
      category: 'food',
      date: '2026-10-25T20:30:00.000Z',
      payerId: samMemberId,
      splitType: 'custom',
      splits: [
        { memberId: alexMemberId, shareMinor: 6000 },
        { memberId: samMemberId, shareMinor: 5050 },
        { memberId: jordanMemberId, shareMinor: 5500 },
        { memberId: taylorMemberId, shareMinor: 4500 },
      ],
    },
  ];

  const stagedSplitsForStats: { memberId: string; shareMinor: number; payerMemberId: string }[] = [];
  const stagedExpensesForBalance: { paidByMemberId: string; amountMinor: number }[] = [];
  const stagedSplitsForBalance: { memberId: string; shareMinor: number }[] = [];

  for (const exp of expensesData) {
    const expenseId = ID.unique();
    const computedSplits =
      exp.splitType === 'equal'
        ? calculateEqualSplits(exp.amountMinor, allMemberIds)
        : exp.splits!;

    // Create multi-row transaction for atomic commit
    const tx = await tablesDB.createTransaction({});

    try {
      // 1. Stage Expense row
      await tablesDB.createRow({
        databaseId,
        tableId: 'expenses',
        rowId: expenseId,
        data: {
          description: exp.desc,
          amountMinor: exp.amountMinor,
          category: exp.category,
          expenseDate: exp.date,
          splitType: exp.splitType,
          group: groupId,
          paidBy: exp.payerId,
        },
        permissions: [
          Permission.read(Role.team(teamId)),
          Permission.update(Role.team(teamId)),
          Permission.delete(Role.team(teamId)),
        ],
        transactionId: tx.$id,
      });

      // 2. Stage Split rows
      for (const sp of computedSplits) {
        await tablesDB.createRow({
          databaseId,
          tableId: 'splits',
          rowId: ID.unique(),
          data: {
            shareMinor: sp.shareMinor,
            expense: expenseId,
            member: sp.memberId,
          },
          permissions: [
            Permission.read(Role.team(teamId)),
            Permission.update(Role.team(teamId)),
            Permission.delete(Role.team(teamId)),
          ],
          transactionId: tx.$id,
        });

        stagedSplitsForStats.push({
          memberId: sp.memberId,
          shareMinor: sp.shareMinor,
          payerMemberId: exp.payerId,
        });

        stagedSplitsForBalance.push({
          memberId: sp.memberId,
          shareMinor: sp.shareMinor,
        });
      }

      await tablesDB.updateTransaction({ transactionId: tx.$id, commit: true });
      console.log(`  ✓ Transaction committed: "${exp.desc}" (${formatCurrency(exp.amountMinor, 'USD')})`);
    } catch (err: any) {
      await tablesDB.updateTransaction({ transactionId: tx.$id, rollback: true }).catch(() => {});
      throw err;
    }

    stagedExpensesForBalance.push({
      paidByMemberId: exp.payerId,
      amountMinor: exp.amountMinor,
    });
  }

  // 7. Seed Past Settlement Records
  console.log('\n7. Recording 2 past settlements in "settlements" table...');
  const settlementsData = [
    {
      fromMemberId: samMemberId,
      toMemberId: alexMemberId,
      amountMinor: 20000, // $200.00
      settledAt: '2026-09-29T16:00:00.000Z',
    },
    {
      fromMemberId: taylorMemberId,
      toMemberId: alexMemberId,
      amountMinor: 30000, // $300.00
      settledAt: '2026-10-15T18:30:00.000Z',
    },
  ];

  for (const st of settlementsData) {
    await tablesDB.createRow({
      databaseId,
      tableId: 'settlements',
      rowId: ID.unique(),
      data: {
        group: groupId,
        fromMember: st.fromMemberId,
        toMember: st.toMemberId,
        amountMinor: st.amountMinor,
        settledAt: st.settledAt,
      },
      permissions: [
        Permission.read(Role.team(teamId)),
        Permission.update(Role.team(teamId)),
        Permission.delete(Role.team(teamId)),
      ],
    });
    console.log(
      `  ✓ Recorded settlement: ${formatCurrency(st.amountMinor, 'USD')} settled on ${st.settledAt.split('T')[0]}`
    );
  }

  // 8. Compute Settle-Up Savings & Print Summary
  const naiveCount = calculateNaiveTransferCount(stagedSplitsForStats);

  const balances = calculateBalances({
    memberIds: allMemberIds,
    expenses: stagedExpensesForBalance,
    splits: stagedSplitsForBalance,
    settlements: settlementsData,
  });

  const minimalPlan = calculateMinimalSettlements(balances);
  const reduction = Math.round(((naiveCount - minimalPlan.length) / naiveCount) * 100);

  console.log('\n===========================================================');
  console.log('🎉 SEED COMPLETED SUCCESSFULLY!');
  console.log('===========================================================');
  console.log(`Group Name:        Flat 402`);
  console.log(`Group ID:          ${groupId}`);
  console.log(`Invite Code:       ${inviteCode}`);
  console.log(`Appwrite Team ID:  ${teamId}`);
  console.log(`Total Expenses:    ${expensesData.length} recorded`);
  console.log(`Naive Transfers:   ${naiveCount} payments`);
  console.log(`Minimal Plan:      ${minimalPlan.length} payments`);
  console.log(`Payment Reduction: -${reduction}% fewer transfers! 🚀`);
  console.log('-----------------------------------------------------------');
  console.log('🔑 DEMO LOGIN CREDENTIALS:');
  console.log(`   Email:    demo@splitnest.app`);
  console.log(`   Password: ${demoPassword}`);
  console.log('-----------------------------------------------------------');
  console.log('👥 ROOMMATES IN GROUP:');
  for (const r of roommates) {
    const b = balances.get(memberRows[r.key].$id);
    const net = b ? b.netBalanceMinor : 0;
    const netFormatted = formatCurrency(net, 'USD');
    console.log(`   • ${r.displayName.padEnd(8)}: ${net >= 0 ? '+' : ''}${netFormatted}`);
  }
  console.log('-----------------------------------------------------------');
  console.log('💡 RECOMMENDED MINIMAL SETTLE-UP PAYMENTS:');
  minimalPlan.forEach((p, idx) => {
    const from = roommates.find((r) => memberRows[r.key].$id === p.fromMemberId)?.displayName;
    const to = roommates.find((r) => memberRows[r.key].$id === p.toMemberId)?.displayName;
    console.log(`   ${idx + 1}. ${from} pays ${to} -> ${formatCurrency(p.amountMinor, 'USD')}`);
  });
  console.log('===========================================================\n');
}

seed().catch((err) => {
  console.error('\n❌ Seed failed with error:', err);
  process.exit(1);
});
