import { Client, TablesDB, RelationshipType, RelationMutate, TablesDBIndexType } from 'node-appwrite';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local or .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const endpoint =
  process.env.APPWRITE_ENDPOINT ||
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ||
  'https://cloud.appwrite.io/v1';
const projectId =
  process.env.APPWRITE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ||
  '';
const apiKey = process.env.APPWRITE_API_KEY || '';
const databaseId =
  process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'splitnest';

if (!projectId || !apiKey) {
  console.error('❌ Missing APPWRITE_PROJECT_ID or APPWRITE_API_KEY.');
  console.error('Please configure .env.local with your project credentials.');
  process.exit(1);
}

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const tablesDB = new TablesDB(client);

// Helper to delay between column creation so Appwrite indexing pipeline processes smoothly
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getOrCreateDatabase(dbId: string, name: string) {
  try {
    const existing = await tablesDB.get({ databaseId: dbId });
    console.log(`✓ Database "${existing.name}" (${dbId}) exists.`);
    return existing;
  } catch (err: any) {
    if (err.code === 404 || err.type === 'database_not_found') {
      console.log(`Creating database "${name}" (${dbId})...`);
      return await tablesDB.create({ databaseId: dbId, name });
    }
    throw err;
  }
}

async function getOrCreateTable(tableId: string, name: string) {
  try {
    const existing = await tablesDB.getTable({ databaseId, tableId });
    console.log(`✓ Table "${existing.name}" (${tableId}) exists.`);
    return existing;
  } catch (err: any) {
    if (err.code === 404 || err.type === 'table_not_found') {
      console.log(`Creating table "${name}" (${tableId}) with row-level security...`);
      return await tablesDB.createTable({
        databaseId,
        tableId,
        name,
        permissions: [], // Secure by default: no public access
        rowSecurity: true, // Enforce row-level permissions for Role.team(teamId)
      });
    }
    throw err;
  }
}

async function ensureVarcharColumn(
  tableId: string,
  key: string,
  size: number,
  required: boolean,
  xdefault?: string
) {
  try {
    await tablesDB.getColumn({ databaseId, tableId, key });
    console.log(`  ✓ Column ${tableId}.${key} exists.`);
  } catch (err: any) {
    if (err.code === 404 || err.type === 'column_not_found') {
      console.log(`  Creating varchar column ${tableId}.${key} (size: ${size})...`);
      await tablesDB.createVarcharColumn({
        databaseId,
        tableId,
        key,
        size,
        required,
        xdefault: xdefault ?? null,
      });
      await wait(600);
    } else {
      throw err;
    }
  }
}

async function ensureIntegerColumn(
  tableId: string,
  key: string,
  required: boolean,
  xdefault?: number
) {
  try {
    await tablesDB.getColumn({ databaseId, tableId, key });
    console.log(`  ✓ Column ${tableId}.${key} exists.`);
  } catch (err: any) {
    if (err.code === 404 || err.type === 'column_not_found') {
      console.log(`  Creating integer column ${tableId}.${key}...`);
      await tablesDB.createIntegerColumn({
        databaseId,
        tableId,
        key,
        required,
        xdefault: xdefault ?? null,
      });
      await wait(600);
    } else {
      throw err;
    }
  }
}

async function ensureDatetimeColumn(
  tableId: string,
  key: string,
  required: boolean
) {
  try {
    await tablesDB.getColumn({ databaseId, tableId, key });
    console.log(`  ✓ Column ${tableId}.${key} exists.`);
  } catch (err: any) {
    if (err.code === 404 || err.type === 'column_not_found') {
      console.log(`  Creating datetime column ${tableId}.${key}...`);
      await tablesDB.createDatetimeColumn({
        databaseId,
        tableId,
        key,
        required,
      });
      await wait(600);
    } else {
      throw err;
    }
  }
}

async function ensureEnumColumn(
  tableId: string,
  key: string,
  elements: string[],
  required: boolean,
  xdefault?: string
) {
  try {
    await tablesDB.getColumn({ databaseId, tableId, key });
    console.log(`  ✓ Column ${tableId}.${key} exists.`);
  } catch (err: any) {
    if (err.code === 404 || err.type === 'column_not_found') {
      console.log(`  Creating enum column ${tableId}.${key}...`);
      await tablesDB.createEnumColumn({
        databaseId,
        tableId,
        key,
        elements,
        required,
        xdefault: xdefault ?? null,
      });
      await wait(600);
    } else {
      throw err;
    }
  }
}

async function ensureRelationship(params: {
  tableId: string;
  relatedTableId: string;
  type: RelationshipType;
  key: string;
  twoWayKey?: string;
  twoWay?: boolean;
  onDelete: RelationMutate;
}) {
  try {
    await tablesDB.getColumn({
      databaseId,
      tableId: params.tableId,
      key: params.key,
    });
    console.log(`  ✓ Relationship ${params.tableId}.${params.key} exists.`);
  } catch (err: any) {
    if (err.code === 404 || err.type === 'column_not_found') {
      console.log(
        `  Creating relationship ${params.tableId}.${params.key} -> ${params.relatedTableId} (${params.type}, onDelete: ${params.onDelete})...`
      );
      await tablesDB.createRelationshipColumn({
        databaseId,
        tableId: params.tableId,
        relatedTableId: params.relatedTableId,
        type: params.type,
        key: params.key,
        twoWay: params.twoWay ?? true,
        twoWayKey: params.twoWayKey ?? undefined,
        onDelete: params.onDelete,
      });
      await wait(1000);
    } else {
      throw err;
    }
  }
}

async function ensureIndex(
  tableId: string,
  key: string,
  type: TablesDBIndexType,
  columns: string[]
) {
  try {
    await tablesDB.getIndex({ databaseId, tableId, key });
    console.log(`  ✓ Index ${tableId}.${key} exists.`);
  } catch (err: any) {
    if (err.code === 404 || err.type === 'index_not_found') {
      console.log(`  Creating ${type} index ${tableId}.${key} on [${columns.join(', ')}]...`);
      await tablesDB.createIndex({
        databaseId,
        tableId,
        key,
        type,
        columns,
      });
      await wait(800);
    } else {
      throw err;
    }
  }
}

export async function setupSplitNestDatabase() {
  console.log(`🚀 Setting up SplitNest TablesDB schema on database: "${databaseId}"`);
  console.log(`Endpoint: ${endpoint} | Project: ${projectId}\n`);

  // 1. Database
  await getOrCreateDatabase(databaseId, 'SplitNest');

  // 2. Tables
  console.log('\n--- Creating Tables with Row-Level Security ---');
  await getOrCreateTable('groups', 'Groups');
  await getOrCreateTable('members', 'Members');
  await getOrCreateTable('expenses', 'Expenses');
  await getOrCreateTable('splits', 'Splits');
  await getOrCreateTable('settlements', 'Settlements');

  // 3. Columns for Groups
  console.log('\n--- Configuring "groups" table columns & indexes ---');
  await ensureVarcharColumn('groups', 'name', 255, true);
  await ensureVarcharColumn('groups', 'currency', 10, true, 'USD');
  await ensureVarcharColumn('groups', 'inviteCode', 32, true);
  await ensureVarcharColumn('groups', 'teamId', 64, true);
  await ensureVarcharColumn('groups', 'createdBy', 64, true);
  await ensureIndex('groups', 'idx_groups_inviteCode', TablesDBIndexType.Unique, ['inviteCode']);

  // 4. Columns for Members
  console.log('\n--- Configuring "members" table columns & indexes ---');
  await ensureVarcharColumn('members', 'displayName', 255, true);
  await ensureVarcharColumn('members', 'userId', 64, true);
  await ensureRelationship({
    tableId: 'members',
    relatedTableId: 'groups',
    type: RelationshipType.ManyToOne,
    key: 'group',
    twoWayKey: 'members',
    twoWay: true,
    onDelete: RelationMutate.Cascade, // If group is deleted, delete member records
  });
  await ensureIndex('members', 'idx_members_userId', TablesDBIndexType.Key, ['userId']);

  // 5. Columns for Expenses
  console.log('\n--- Configuring "expenses" table columns & indexes ---');
  await ensureVarcharColumn('expenses', 'description', 255, true);
  await ensureIntegerColumn('expenses', 'amountMinor', true);
  await ensureEnumColumn(
    'expenses',
    'category',
    ['groceries', 'rent', 'utilities', 'food', 'travel', 'entertainment', 'other'],
    true,
    'other'
  );
  await ensureDatetimeColumn('expenses', 'expenseDate', true);
  await ensureEnumColumn('expenses', 'splitType', ['equal', 'custom'], true, 'equal');
  await ensureRelationship({
    tableId: 'expenses',
    relatedTableId: 'groups',
    type: RelationshipType.ManyToOne,
    key: 'group',
    twoWayKey: 'expenses',
    twoWay: true,
    onDelete: RelationMutate.Cascade, // If group is deleted, delete expenses
  });
  await ensureRelationship({
    tableId: 'expenses',
    relatedTableId: 'members',
    type: RelationshipType.ManyToOne,
    key: 'paidBy',
    twoWayKey: 'expensesPaid',
    twoWay: true,
    onDelete: RelationMutate.Restrict, // Preserves accounting ledger integrity
  });
  await ensureIndex('expenses', 'idx_expenses_group_date', TablesDBIndexType.Key, ['expenseDate']);

  // 6. Columns for Splits
  console.log('\n--- Configuring "splits" table columns & relationships ---');
  await ensureIntegerColumn('splits', 'shareMinor', true);
  await ensureRelationship({
    tableId: 'splits',
    relatedTableId: 'expenses',
    type: RelationshipType.ManyToOne,
    key: 'expense',
    twoWayKey: 'splits',
    twoWay: true,
    onDelete: RelationMutate.Cascade, // Deleting an expense automatically removes its splits
  });
  await ensureRelationship({
    tableId: 'splits',
    relatedTableId: 'members',
    type: RelationshipType.ManyToOne,
    key: 'member',
    twoWayKey: 'assignedSplits',
    twoWay: true,
    onDelete: RelationMutate.Restrict, // Prevent deleting member while assigned to splits
  });

  // 7. Columns for Settlements
  console.log('\n--- Configuring "settlements" table columns & relationships ---');
  await ensureIntegerColumn('settlements', 'amountMinor', true);
  await ensureDatetimeColumn('settlements', 'settledAt', true);
  await ensureRelationship({
    tableId: 'settlements',
    relatedTableId: 'groups',
    type: RelationshipType.ManyToOne,
    key: 'group',
    twoWayKey: 'settlements',
    twoWay: true,
    onDelete: RelationMutate.Cascade,
  });
  await ensureRelationship({
    tableId: 'settlements',
    relatedTableId: 'members',
    type: RelationshipType.ManyToOne,
    key: 'fromMember',
    twoWayKey: 'settlementsPaid',
    twoWay: true,
    onDelete: RelationMutate.Restrict,
  });
  await ensureRelationship({
    tableId: 'settlements',
    relatedTableId: 'members',
    type: RelationshipType.ManyToOne,
    key: 'toMember',
    twoWayKey: 'settlementsReceived',
    twoWay: true,
    onDelete: RelationMutate.Restrict,
  });

  console.log('\n🎉 SplitNest TablesDB schema setup completed successfully!');
}

if (require.main === module) {
  setupSplitNestDatabase().catch((err) => {
    console.error('❌ Setup failed:', err);
    process.exit(1);
  });
}
