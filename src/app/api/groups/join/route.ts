import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/server-auth';
import { createAdminClient } from '@/lib/appwrite/server';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { ID, Permission, Role, Query } from 'node-appwrite';

export async function POST(req: NextRequest) {
  let addedMembershipId: string | null = null;
  let createdMemberId: string | null = null;
  let targetTeamId: string | null = null;

  const { tablesDB, teams } = createAdminClient();
  const databaseId = APPWRITE_CONFIG.databaseId;

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

    // 1. Find group by invite code
    const groupResult = await tablesDB.listRows({
      databaseId,
      tableId: 'groups',
      queries: [Query.equal('inviteCode', [inviteCode.trim().toUpperCase()])],
    });

    if (groupResult.total === 0) {
      return NextResponse.json(
        { error: 'Invalid invite code. No group found with this code.' },
        { status: 404 }
      );
    }

    const group = groupResult.rows[0];
    targetTeamId = group.teamId;

    // 2. Check if already a member in the database
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
    const membership = await teams.createMembership({
      teamId: group.teamId,
      roles: ['member'],
      userId: user.$id,
      email: user.email,
    });
    addedMembershipId = membership.$id;

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
    createdMemberId = member.$id;

    return NextResponse.json({
      success: true,
      group,
      member,
    });
  } catch (err: any) {
    console.error('Error in POST /api/groups/join, rolling back:', err);

    // Rollback any partially created resources
    if (createdMemberId) {
      try {
        await tablesDB.deleteRow({ databaseId, tableId: 'members', rowId: createdMemberId });
      } catch (rbErr) {
        console.error('Rollback failed for member row:', rbErr);
      }
    }

    if (addedMembershipId && targetTeamId) {
      try {
        await teams.deleteMembership({ teamId: targetTeamId, membershipId: addedMembershipId });
      } catch (rbErr) {
        console.error('Rollback failed for team membership:', rbErr);
      }
    }

    const statusCode =
      typeof err.code === 'number' && err.code >= 400 && err.code < 600
        ? err.code
        : 500;

    return NextResponse.json(
      { error: err.message || 'Failed to join group' },
      { status: statusCode }
    );
  }
}
