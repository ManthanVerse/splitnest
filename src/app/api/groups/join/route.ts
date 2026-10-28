import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/server-auth';
import { createAdminClient } from '@/lib/appwrite/server';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { ID, Permission, Role, Query } from 'node-appwrite';

export async function POST(req: NextRequest) {
  try {
    const { user } = await verifyAuth(req);
    const body = await req.json();
    const { inviteCode } = body;

    if (!inviteCode || typeof inviteCode !== 'string') {
      return NextResponse.json(
        { error: 'Invite code is required' },
        { status: 400 }
      );
    }

    const { tablesDB, teams } = createAdminClient();
    const databaseId = APPWRITE_CONFIG.databaseId;

    // 1. Find group by invite code
    const groupResult = await tablesDB.listRows({
      databaseId,
      tableId: 'groups',
      queries: [Query.equal('inviteCode', [inviteCode.trim().toUpperCase()])],
    });

    if (groupResult.total === 0) {
      return NextResponse.json(
        { error: 'Invalid invite code. No group found.' },
        { status: 404 }
      );
    }

    const group = groupResult.rows[0];

    // 2. Check if already a member
    const existingMember = await tablesDB.listRows({
      databaseId,
      tableId: 'members',
      queries: [
        Query.equal('group', [group.$id]),
        Query.equal('userId', [user.$id]),
      ],
    });

    if (existingMember.total > 0) {
      return NextResponse.json({
        success: true,
        message: 'Already a member of this group',
        group,
        member: existingMember.rows[0],
      });
    }

    // 3. Add user to Appwrite Team
    try {
      await teams.createMembership({
        teamId: group.teamId,
        roles: ['member'],
        userId: user.$id,
        email: user.email,
      });
    } catch (teamErr: any) {
      console.warn('Membership addition note (check teams.write API scope):', teamErr.message);
    }

    const teamPermissions = [
      Permission.read(Role.team(group.teamId)),
      Permission.update(Role.team(group.teamId)),
      Permission.delete(Role.team(group.teamId)),
    ];

    // 4. Create Member row in TablesDB
    const member = await tablesDB.createRow({
      databaseId,
      tableId: 'members',
      rowId: ID.unique(),
      data: {
        displayName: user.name || user.email.split('@')[0],
        userId: user.$id,
        group: group.$id,
      },
      permissions: teamPermissions,
    });

    return NextResponse.json({
      success: true,
      group,
      member,
    });
  } catch (err: any) {
    console.error('Error in POST /api/groups/join:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to join group' },
      { status: err.code === 401 ? 401 : 500 }
    );
  }
}
