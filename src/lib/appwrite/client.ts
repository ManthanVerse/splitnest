import { Client, Account, TablesDB, Realtime, Teams } from 'appwrite';
import { APPWRITE_CONFIG } from './config';

let client: Client | null = null;
let account: Account | null = null;
let tablesDB: TablesDB | null = null;
let realtime: Realtime | null = null;
let teams: Teams | null = null;

export function getAppwriteClient() {
  if (typeof window === 'undefined') {
    throw new Error('getAppwriteClient must only be called in browser context');
  }

  if (!client) {
    client = new Client()
      .setEndpoint(APPWRITE_CONFIG.endpoint)
      .setProject(APPWRITE_CONFIG.projectId);

    account = new Account(client);
    tablesDB = new TablesDB(client);
    realtime = new Realtime(client);
    teams = new Teams(client);
  }

  return {
    client,
    account: account!,
    tablesDB: tablesDB!,
    realtime: realtime!,
    teams: teams!,
  };
}

export { APPWRITE_CONFIG };
