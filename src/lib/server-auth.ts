import { NextRequest } from 'next/server';
import { getAuthenticatedUser } from './appwrite/server';
import { Models } from 'node-appwrite';

export async function verifyAuth(req: NextRequest): Promise<{
  user: Models.User<Models.Preferences>;
  jwt: string;
}> {
  const authHeader =
    req.headers.get('Authorization') || req.headers.get('x-appwrite-jwt');

  if (!authHeader) {
    throw new Error('Unauthorized: Missing authentication token');
  }

  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) {
    throw new Error('Unauthorized: Invalid token format');
  }

  const user = await getAuthenticatedUser(jwt);
  return { user, jwt };
}
