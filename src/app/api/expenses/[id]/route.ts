import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/server-auth';
import { createAdminClient } from '@/lib/appwrite/server';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { validateCustomSplits } from '@/lib/split-engine';
import { ID, Permission, Role, Query } from 'node-appwrite';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await verifyAuth(req);
    const { id: expenseId } = await params;
    const { tablesDB } = createAdminClient();
    const databaseId = APPWRITE_CONFIG.databaseId;

    // 1. Fetch expense to verify ownership/group
    const expense = await tablesDB.getRow({
      databaseId,
      tableId: 'expenses',
      rowId: expenseId,
      queries: [Query.select(['*', 'group.*'])],
    });

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const groupId = typeof expense.group === 'object' ? expense.group.$id : expense.group;

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
        { error: 'Forbidden: You do not have permission to delete this expense' },
        { status: 403 }
      );
    }

    // 3. Delete expense (Schema Cascade deletes its related splits)
    await tablesDB.deleteRow({
      databaseId,
      tableId: 'expenses',
      rowId: expenseId,
    });

    return NextResponse.json({ success: true, message: 'Expense deleted' });
  } catch (err: any) {
    console.error('Error in DELETE /api/expenses/[id]:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to delete expense' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await verifyAuth(req);
    const { id: expenseId } = await params;
    const body = await req.json();

    const {
      description,
      amountMinor,
      category,
      expenseDate,
      paidByMemberId,
      splitType,
      splits,
    } = body;

    const { tablesDB } = createAdminClient();
    const databaseId = APPWRITE_CONFIG.databaseId;

    // 1. Fetch existing expense
    const expense = await tablesDB.getRow({
      databaseId,
      tableId: 'expenses',
      rowId: expenseId,
      queries: [Query.select(['*', 'group.*'])],
    });

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const groupId = typeof expense.group === 'object' ? expense.group.$id : expense.group;
    const teamId = typeof expense.group === 'object' ? expense.group.teamId : '';

    // 2. Verify caller is a group member
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
        { error: 'Forbidden: You do not have permission to update this expense' },
        { status: 403 }
      );
    }

    // Validate splits if updated
    if (splits) {
      const validation = validateCustomSplits(amountMinor, splits);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error || 'Splits total must match expense amount' },
          { status: 400 }
        );
      }
    }

    const teamPermissions = teamId
      ? [
          Permission.read(Role.team(teamId)),
          Permission.update(Role.team(teamId)),
          Permission.delete(Role.team(teamId)),
        ]
      : [];

    // 3. Atomic update using TablesDB Transaction
    const tx = await tablesDB.createTransaction();

    try {
      // Stage expense update
      await tablesDB.updateRow({
        databaseId,
        tableId: 'expenses',
        rowId: expenseId,
        data: {
          description: description?.trim(),
          amountMinor,
          category,
          expenseDate,
          paidBy: paidByMemberId,
          splitType,
        },
        transactionId: tx.$id,
      });

      // If new splits are provided, stage deleting old splits and creating new ones
      if (splits && splits.length > 0) {
        const oldSplits = await tablesDB.listRows({
          databaseId,
          tableId: 'splits',
          queries: [Query.equal('expense', [expenseId])],
        });

        for (const oldSplit of oldSplits.rows) {
          await tablesDB.deleteRow({
            databaseId,
            tableId: 'splits',
            rowId: oldSplit.$id,
            transactionId: tx.$id,
          });
        }

        for (const newSplit of splits) {
          await tablesDB.createRow({
            databaseId,
            tableId: 'splits',
            rowId: ID.unique(),
            data: {
              expense: expenseId,
              member: newSplit.memberId,
              shareMinor: newSplit.shareMinor,
            },
            permissions: teamPermissions,
            transactionId: tx.$id,
          });
        }
      }

      await tablesDB.updateTransaction({
        transactionId: tx.$id,
        commit: true,
      });

      return NextResponse.json({ success: true, message: 'Expense updated' });
    } catch (txError: any) {
      await tablesDB
        .updateTransaction({
          transactionId: tx.$id,
          rollback: true,
        })
        .catch(() => {});
      throw txError;
    }
  } catch (err: any) {
    console.error('Error in PATCH /api/expenses/[id]:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to update expense' },
      { status: 500 }
    );
  }
}
