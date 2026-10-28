import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/server-auth';
import { createAdminClient } from '@/lib/appwrite/server';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { ID, Permission, Role } from 'node-appwrite';

export async function POST(req: NextRequest) {
  let createdTeamId: string | null = null;
  let createdGroupId: string | null = null;
  let createdMemberId: string | null = null;

  const { tablesDB, teams } = createAdminClient(req);
  const databaseId = APPWRITE_CONFIG.databaseId;

  try {
    const { user } = await verifyAuth(req);
    const body = await req.json();
    const { name, currency = 'USD' } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Group name is required' },
        { status: 400 }
      );
    }

    // Generate unique identifiers
    const groupId = ID.unique();
    const teamId = ID.unique();
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // 1. Create Appwrite Team for group membership
    await teams.create({ teamId, name: name.trim() });
    createdTeamId = teamId;

    // 2. Add creator as team owner
    await teams.createMembership({
      teamId,
      roles: ['owner'],
      userId: user.$id,
      email: user.email,
    });

    const teamPermissions = [
      Permission.read(Role.team(teamId)),
      Permission.update(Role.team(teamId)),
      Permission.delete(Role.team(teamId)),
    ];

    // 3. Create Group row in TablesDB with row-level permissions
    const group = await tablesDB.createRow({
      databaseId,
      tableId: 'groups',
      rowId: groupId,
      data: {
        name: name.trim(),
        currency: currency.toUpperCase(),
        inviteCode,
        teamId,
        createdBy: user.$id,
      },
      permissions: teamPermissions,
    });
    createdGroupId = group.$id;

    // 4. Create Member row for creator in TablesDB
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
    console.error('Error in POST /api/groups, initiating rollback:', err);

    // Rollback any partially created resources in reverse order
    if (createdMemberId) {
      try {
        await tablesDB.deleteRow({ databaseId, tableId: 'members', rowId: createdMemberId });
      } catch (rbErr) {
        console.error('Rollback failed for member:', rbErr);
      }
    }

    if (createdGroupId) {
      try {
        await tablesDB.deleteRow({ databaseId, tableId: 'groups', rowId: createdGroupId });
      } catch (rbErr) {
        console.error('Rollback failed for group:', rbErr);
      }
    }

    if (createdTeamId) {
      try {
        await teams.delete({ teamId: createdTeamId });
      } catch (rbErr) {
        console.error('Rollback failed for team:', rbErr);
      }
    }

    const statusCode =
      typeof err.code === 'number' && err.code >= 400 && err.code < 600
        ? err.code
        : 500;

    return NextResponse.json(
      { error: err.message || 'Failed to create group' },
      { status: statusCode }
    );
  }
}
