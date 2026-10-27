import { Client, TablesDB, Teams, Users, Account } from 'node-appwrite';
import { APPWRITE_CONFIG } from './config';

/**
 * Creates an admin Client powered by the secret API key.
 * Used ONLY in server-side route handlers and CLI scripts for privileged operations
 * (creating databases, tables, columns, indexes, teams, and membership assignments).
 */
export function createAdminClient() {
  const apiKey = APPWRITE_CONFIG.apiKey;
  const endpoint = APPWRITE_CONFIG.endpoint;
  const projectId = APPWRITE_CONFIG.projectId;

  if (!apiKey || !projectId) {
    throw new Error(
      'Missing APPWRITE_API_KEY or APPWRITE_PROJECT_ID in server environment'
    );
  }

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  return {
    client,
    tablesDB: new TablesDB(client),
    teams: new Teams(client),
    users: new Users(client),
  };
}

/**
 * Creates a user session client using the caller's JWT.
 * Allows server route handlers to verify identity and act with user context.
 */
export function createSessionClient(jwt: string) {
  if (!jwt) {
    throw new Error('JWT token is required to create a session client');
  }

  const client = new Client()
    .setEndpoint(APPWRITE_CONFIG.endpoint)
    .setProject(APPWRITE_CONFIG.projectId)
    .setJWT(jwt);

  return {
    client,
    account: new Account(client),
    tablesDB: new TablesDB(client),
    teams: new Teams(client),
  };
}

/**
 * Securely extracts and verifies the authenticated user from a JWT.
 * NEVER trust a userId sent in the request body.
 */
export async function getAuthenticatedUser(jwt: string) {
  const { account } = createSessionClient(jwt);
  return await account.get();
}
