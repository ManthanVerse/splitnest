import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/server-auth';
import { createAdminClient } from '@/lib/appwrite/server';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { ID, Permission, Role } from 'node-appwrite';

export async function POST(req: NextRequest) {
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

    const { tablesDB, teams } = createAdminClient();
    const databaseId = APPWRITE_CONFIG.databaseId;

    // Generate unique identifiers
    const groupId = ID.unique();
    const teamId = ID.unique();
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // 1. Create Appwrite Team for group membership
    try {
      await teams.create({ teamId, name: name.trim() });
      await teams.createMembership({
        teamId,
        roles: ['owner'],
        userId: user.$id,
        email: user.email,
      });
    } catch (teamErr: any) {
      console.warn('Team creation error (check teams.write API scope):', teamErr.message);
      // If team API is restricted, we still proceed with teamId for permissions
    }

    const teamPermissions = [
      Permission.read(Role.team(teamId)),
      Permission.update(Role.team(teamId)),
      Permission.delete(Role.team(teamId)),
    ];

    // 2. Create Group row in TablesDB
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

    // 3. Create Member row for creator in TablesDB
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
    console.error('Error in POST /api/groups:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create group' },
      { status: err.code === 401 ? 401 : 500 }
    );
  }
}
