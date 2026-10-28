import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/server-auth';
import { createAdminClient } from '@/lib/appwrite/server';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { ID, Permission, Role, Query } from 'node-appwrite';

export async function POST(req: NextRequest) {
  try {
    const { user } = await verifyAuth(req);
    const body = await req.json();

    const {
      groupId,
      fromMemberId,
      toMemberId,
      amountMinor,
      settledAt,
    } = body;

    if (!groupId || !fromMemberId || !toMemberId || !amountMinor) {
      return NextResponse.json(
        { error: 'Missing required settlement fields' },
        { status: 400 }
      );
    }

    if (amountMinor <= 0 || !Number.isInteger(amountMinor)) {
      return NextResponse.json(
        { error: 'Settlement amount must be a positive integer in minor units' },
        { status: 400 }
      );
    }

    const { tablesDB } = createAdminClient(req);
    const databaseId = APPWRITE_CONFIG.databaseId;

    // 1. Verify group
    const group = await tablesDB.getRow({
      databaseId,
      tableId: 'groups',
      rowId: groupId,
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // 2. Verify caller is a member of the group
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

    // 3. Create settlement row
    const settlement = await tablesDB.createRow({
      databaseId,
      tableId: 'settlements',
      rowId: ID.unique(),
      data: {
        group: groupId,
        fromMember: fromMemberId,
        toMember: toMemberId,
        amountMinor,
        settledAt: settledAt || new Date().toISOString(),
      },
      permissions: teamPermissions,
    });

    return NextResponse.json({
      success: true,
      settlement,
    });
  } catch (err: any) {
    console.error('Error in POST /api/settlements:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to record settlement' },
      { status: 500 }
    );
  }
}
