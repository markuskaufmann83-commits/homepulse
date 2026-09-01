import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { queryItems, saveItem, deleteItemById } from '../shared/db';
import { FamilyMember } from '../shared/types';

const CONTAINER = 'members';

function getHouseholdId(req: HttpRequest): string {
  return (
    req.headers.get('x-household-id') ||
    req.query.get('householdId') ||
    'default_household'
  );
}

export async function membersHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = req.method;
  const householdId = getHouseholdId(req);

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-household-id'
  };

  if (method === 'OPTIONS') {
    return { status: 204, headers };
  }

  try {
    if (method === 'GET') {
      const allMembers = await queryItems<FamilyMember>(CONTAINER);
      // Filter by household
      const filtered = allMembers.filter(
        m => !m.householdId || m.householdId === householdId
      );
      return { status: 200, headers, body: JSON.stringify(filtered) };
    }

    if (method === 'POST') {
      const data = (await req.json()) as Partial<FamilyMember>;
      if (!data.name) {
        return { status: 400, headers, body: JSON.stringify({ error: 'Name is required' }) };
      }

      const newMember: FamilyMember = {
        id: data.id || `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        householdId: data.householdId || householdId,
        userId: data.userId,
        name: data.name,
        role: data.role || 'member',
        avatar: data.avatar || '👤',
        color: data.color || '#3B82F6',
        status: data.status || 'home',
        statusMessage: data.statusMessage,
        locationShared: data.locationShared !== false,
        updatedAt: new Date().toISOString()
      };

      const saved = await saveItem<FamilyMember>(CONTAINER, newMember);
      return { status: 201, headers, body: JSON.stringify(saved) };
    }

    if (method === 'PUT') {
      const data = (await req.json()) as FamilyMember;
      if (!data.id) {
        return { status: 400, headers, body: JSON.stringify({ error: 'Member id is required for update' }) };
      }

      data.householdId = data.householdId || householdId;
      data.updatedAt = new Date().toISOString();
      const updated = await saveItem<FamilyMember>(CONTAINER, data);
      return { status: 200, headers, body: JSON.stringify(updated) };
    }

    if (method === 'DELETE') {
      const id = req.query.get('id');
      if (!id) {
        return { status: 400, headers, body: JSON.stringify({ error: 'Member id query parameter is required' }) };
      }

      const deleted = await deleteItemById(CONTAINER, id);
      return { status: 200, headers, body: JSON.stringify({ success: deleted, id }) };
    }

    return { status: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  } catch (error: any) {
    context.error('Error in membersHandler:', error);
    return { status: 500, headers, body: JSON.stringify({ error: error.message || 'Internal Server Error' }) };
  }
}

app.http('members', {
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'members',
  handler: membersHandler
});
