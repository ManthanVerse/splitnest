export const APPWRITE_CONFIG = {
  endpoint:
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ||
    process.env.APPWRITE_SITE_API_ENDPOINT ||
    process.env.APPWRITE_ENDPOINT ||
    'https://cloud.appwrite.io/v1',
  projectId:
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ||
    process.env.APPWRITE_SITE_PROJECT_ID ||
    process.env.APPWRITE_PROJECT_ID ||
    '',
  apiKey:
    process.env.APPWRITE_API_KEY ||
    process.env.APPWRITE_SITE_API_KEY ||
    '',
  databaseId:
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'splitnest',
  tables: {
    groups: process.env.NEXT_PUBLIC_APPWRITE_TABLE_GROUPS || 'groups',
    members: process.env.NEXT_PUBLIC_APPWRITE_TABLE_MEMBERS || 'members',
    expenses: process.env.NEXT_PUBLIC_APPWRITE_TABLE_EXPENSES || 'expenses',
    splits: process.env.NEXT_PUBLIC_APPWRITE_TABLE_SPLITS || 'splits',
    settlements: process.env.NEXT_PUBLIC_APPWRITE_TABLE_SETTLEMENTS || 'settlements',
  },
};
