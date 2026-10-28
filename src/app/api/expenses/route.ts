import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/server-auth';
import { createAdminClient } from '@/lib/appwrite/server';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { validateCustomSplits } from '@/lib/split-engine';
import { ID, Permission, Role, Query } from 'node-appwrite';

export async function POST(req: NextRequest) {
  try {
    const { user } = await verifyAuth(req);
    const body = await req.json();

    const {
      groupId,
      description,
      amountMinor,
      category = 'other',
      expenseDate,
      paidByMemberId,
      splitType = 'equal',
      splits,
    } = body;

    if (!groupId || !description || !amountMinor || !paidByMemberId || !splits) {
      return NextResponse.json(
        { error: 'Missing required expense fields' },
        { status: 400 }
      );
    }

    if (amountMinor <= 0 || !Number.isInteger(amountMinor)) {
      return NextResponse.json(
        { error: 'Amount must be a positive integer in minor units' },
        { status: 400 }
      );
    }

    // Validate splits sum
    const validation = validateCustomSplits(amountMinor, splits);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || 'Splits total must match expense amount' },
        { status: 400 }
      );
    }

    const { tablesDB } = createAdminClient();
    const databaseId = APPWRITE_CONFIG.databaseId;

    // 1. Verify group exists and get teamId
    const group = await tablesDB.getRow({
      databaseId,
      tableId: 'groups',
      rowId: groupId,
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // 2. Verify caller is a member of this group
    const memberCheck = await tablesDB.listRows({
      databaseId,
      tableId: 'members',
      queries: [
        Query.equal('group', [groupId]),
        Query.equal('userId', [user.$id]),
      ],
    });

    if (memberCheck.total === 0) {
      return NextResponse.json(
        { error: 'Forbidden: You are not a member of this group' },
        { status: 403 }
      );
    }

    const teamPermissions = [
      Permission.read(Role.team(group.teamId)),
      Permission.update(Role.team(group.teamId)),
      Permission.delete(Role.team(group.teamId)),
    ];

    // 3. ATOMIC TRANSACTION: Create Expense + All Splits atomically
    const tx = await tablesDB.createTransaction();
    const expenseId = ID.unique();

    try {
      // Stage expense row
      await tablesDB.createRow({
        databaseId,
        tableId: 'expenses',
        rowId: expenseId,
        data: {
          description: description.trim(),
          amountMinor,
          category,
          expenseDate: expenseDate || new Date().toISOString(),
          splitType,
          group: groupId,
          paidBy: paidByMemberId,
        },
        permissions: teamPermissions,
        transactionId: tx.$id,
      });

      // Stage each split row
      for (const split of splits) {
        await tablesDB.createRow({
          databaseId,
          tableId: 'splits',
          rowId: ID.unique(),
          data: {
            expense: expenseId,
            member: split.memberId,
            shareMinor: split.shareMinor,
          },
          permissions: teamPermissions,
          transactionId: tx.$id,
        });
      }

      // Commit transaction
      await tablesDB.updateTransaction({
        transactionId: tx.$id,
        commit: true,
      });

      return NextResponse.json({
        success: true,
        expenseId,
        transactionId: tx.$id,
      });
    } catch (txError: any) {
      console.error('Transaction failed, rolling back:', txError);
      await tablesDB
        .updateTransaction({
          transactionId: tx.$id,
          rollback: true,
        })
        .catch(() => {});
      throw txError;
    }
  } catch (err: any) {
    console.error('Error in POST /api/expenses:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create expense atomically' },
      { status: err.code === 401 ? 401 : err.code === 403 ? 403 : 500 }
    );
  }
}
