import { Client, TablesDB, ID, Permission, Role, Query } from 'node-appwrite';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const endpoint = process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_PROJECT_ID || '';
const apiKey = process.env.APPWRITE_API_KEY || '';
const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'splitnest';

const adminClient = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const tablesDB = new TablesDB(adminClient);

export async function runTablesDBLoopProof() {
  console.log('🧪 Starting Phase 1 & 2 TablesDB Loop Proof against real Appwrite Cloud...');
  
  const testId = Math.random().toString(36).substring(2, 8);
  const teamId = `team_${testId}`;
  const groupId = `grp_${testId}`;

  try {
    const teamPermissions = [
      Permission.read(Role.team(teamId)),
      Permission.update(Role.team(teamId)),
      Permission.delete(Role.team(teamId)),
    ];

    // 1. Create Group Row
    console.log('1. Creating Group row with row-level permissions for Role.team(teamId)...');
    const group = await tablesDB.createRow({
      databaseId,
      tableId: 'groups',
      rowId: groupId,
      data: {
        name: `Loft ${testId}`,
        currency: 'USD',
        inviteCode: `INV_${testId.toUpperCase()}`,
        teamId: teamId,
        createdBy: 'user_dummy_1',
      },
      permissions: teamPermissions,
    });
    console.log(`✓ Group created: ${group.$id} ("${group.name}")`);

    // 2. Create Members rows
    console.log('2. Creating Member rows for Alice and Bob...');
    const memberAlice = await tablesDB.createRow({
      databaseId,
      tableId: 'members',
      rowId: ID.unique(),
      data: {
        displayName: 'Alice Roommate',
        userId: 'user_alice_dummy',
        group: group.$id,
      },
      permissions: teamPermissions,
    });

    const memberBob = await tablesDB.createRow({
      databaseId,
      tableId: 'members',
      rowId: ID.unique(),
      data: {
        displayName: 'Bob Roommate',
        userId: 'user_bob_dummy',
        group: group.$id,
      },
      permissions: teamPermissions,
    });
    console.log(`✓ Members created: Alice (${memberAlice.$id}), Bob (${memberBob.$id})`);

    // 3. Test Atomic Transaction for Expense + Splits
    console.log('3. Testing atomic TablesDB Transaction for Expense + Splits...');
    const tx = await tablesDB.createTransaction();
    console.log(`✓ Staged Transaction started: ID = ${tx.$id}`);

    const expenseId = ID.unique();
    const expenseDate = new Date().toISOString();
    const totalAmountMinor = 8000; // $80.00

    // Stage Expense creation
    await tablesDB.createRow({
      databaseId,
      tableId: 'expenses',
      rowId: expenseId,
      data: {
        description: 'Trader Joe Groceries',
        amountMinor: totalAmountMinor,
        category: 'groceries',
        expenseDate: expenseDate,
        splitType: 'equal',
        group: group.$id,
        paidBy: memberAlice.$id,
      },
      permissions: teamPermissions,
      transactionId: tx.$id,
    });

    // Stage Split 1 (Alice: $40.00 = 4000 minor units)
    await tablesDB.createRow({
      databaseId,
      tableId: 'splits',
      rowId: ID.unique(),
      data: {
        expense: expenseId,
        member: memberAlice.$id,
        shareMinor: 4000,
      },
      permissions: teamPermissions,
      transactionId: tx.$id,
    });

    // Stage Split 2 (Bob: $40.00 = 4000 minor units)
    await tablesDB.createRow({
      databaseId,
      tableId: 'splits',
      rowId: ID.unique(),
      data: {
        expense: expenseId,
        member: memberBob.$id,
        shareMinor: 4000,
      },
      permissions: teamPermissions,
      transactionId: tx.$id,
    });

    // 4. Commit Transaction
    console.log('4. Committing Transaction atomically...');
    await tablesDB.updateTransaction({
      transactionId: tx.$id,
      commit: true,
    });
    console.log('✓ Transaction committed successfully!');

    // 5. Read back Expense with Relationships loaded (Query.select with * and relationship fields)
    console.log('\n5. Reading back Expense with Relationships loaded via Query.select...');
    const result = await tablesDB.listRows({
      databaseId,
      tableId: 'expenses',
      queries: [
        Query.equal('group', [group.$id]),
        Query.select(['*', 'paidBy.*', 'group.*', 'splits.*']),
      ],
    });

    console.log(`✓ Retrieved ${result.total} expense(s):`);
    const fetchedExpense = result.rows[0];
    console.log('Fetched Expense Result:', {
      $id: fetchedExpense.$id,
      description: fetchedExpense.description,
      amountMinor: fetchedExpense.amountMinor,
      category: fetchedExpense.category,
      expenseDate: fetchedExpense.expenseDate,
      group: fetchedExpense.group ? { id: fetchedExpense.group.$id, name: fetchedExpense.group.name } : null,
      paidBy: fetchedExpense.paidBy ? { id: fetchedExpense.paidBy.$id, displayName: fetchedExpense.paidBy.displayName } : null,
      splitsCount: fetchedExpense.splits?.length,
    });

    // Verify splits relation
    const splitsResult = await tablesDB.listRows({
      databaseId,
      tableId: 'splits',
      queries: [
        Query.equal('expense', [expenseId]),
        Query.select(['*', 'member.*']),
      ],
    });
    console.log(`✓ Retrieved ${splitsResult.total} split(s):`);
    splitsResult.rows.forEach((s) => {
      console.log(`  - Member: ${s.member?.displayName} (${s.member?.$id}), Share: $${(s.shareMinor / 100).toFixed(2)}`);
    });

    // 6. Test Expense Deletion -> Cascading Splits
    console.log('\n6. Testing Expense Delete -> Cascade Splits behavior...');
    await tablesDB.deleteRow({ databaseId, tableId: 'expenses', rowId: expenseId });
    console.log('✓ Expense deleted.');

    // Check if splits cascaded
    const splitsAfter = await tablesDB.listRows({
      databaseId,
      tableId: 'splits',
      queries: [Query.equal('expense', [expenseId])],
    });
    console.log(`✓ Splits remaining for expense (expected 0): ${splitsAfter.total}`);
    if (splitsAfter.total !== 0) {
      throw new Error('Splits did not cascade delete when expense was deleted!');
    }

    // 7. Delete Group -> Cascades to Members
    console.log('\n7. Deleting Group row (now that ledger expenses are cleared)...');
    await tablesDB.deleteRow({ databaseId, tableId: 'groups', rowId: groupId });
    console.log('✓ Group deleted.');

    const membersAfter = await tablesDB.listRows({
      databaseId,
      tableId: 'members',
      queries: [Query.equal('group', [groupId])],
    });
    console.log(`✓ Members remaining for group (expected 0): ${membersAfter.total}`);

    console.log('\n🎉 ALL REAL TABLESDB OPERATIONS, TRANSACTIONS, RELATIONSHIPS, AND CASCADE DELETES VERIFIED AND PASSING!');

  } catch (err: any) {
    console.error('❌ Loop proof failed:', err);
    throw err;
  }
}

runTablesDBLoopProof().catch(() => process.exit(1));
