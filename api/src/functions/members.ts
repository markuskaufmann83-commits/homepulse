import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { queryItems, saveItem, deleteItemById } from '../shared/db';
import { FamilyMember } from '../shared/types';

const CONTAINER = 'members';

// Default initial members if empty
const DEFAULT_MEMBERS: FamilyMember[] = [
  {
    id: 'mem_1',
    name: 'Mama Lisa',
    role: 'admin',
    avatar: '👩‍💼',
    color: '#EC4899', // Pink
    status: 'home',
    statusMessage: 'Zuhause im Homeoffice',
    locationShared: true,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mem_2',
    name: 'Papa Thomas',
    role: 'admin',
    avatar: '👨‍💻',
    color: '#3B82F6', // Blue
    status: 'work',
    statusMessage: 'Im Büro bis 17:00',
    locationShared: true,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mem_3',
    name: 'Mia',
    role: 'child',
    avatar: '👧',
    color: '#8B5CF6', // Purple
    status: 'school',
    statusMessage: 'In der Schule',
    locationShared: true,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mem_4',
    name: 'Jonas',
    role: 'child',
    avatar: '👦',
    color: '#10B981', // Emerald Green
    status: 'home',
    statusMessage: 'Zuhause & Hausaufgaben',
    locationShared: true,
    updatedAt: new Date().toISOString()
  }
];

export async function membersHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = req.method;
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (method === 'OPTIONS') {
    return { status: 204, headers };
  }

  try {
    if (method === 'GET') {
      let items = await queryItems<FamilyMember>(CONTAINER);
      if (items.length === 0) {
        // Seed default members if empty
        for (const m of DEFAULT_MEMBERS) {
          await saveItem<FamilyMember>(CONTAINER, m);
        }
        items = DEFAULT_MEMBERS;
      }
      return { status: 200, headers, body: JSON.stringify(items) };
    }

    if (method === 'POST') {
      const data = (await req.json()) as Partial<FamilyMember>;
      if (!data.name) {
        return { status: 400, headers, body: JSON.stringify({ error: 'Name is required' }) };
      }

      const newMember: FamilyMember = {
        id: data.id || `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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

      data.updatedAt = new Date().toISOString();
      const updated = await saveItem<FamilyMember>(CONTAINER, data);
      return { status: 200, headers, body: JSON.stringify(updated) };
    }

    if (method === 'DELETE') {
      const id = req.query.get('id');
      if (!id) {
        return { status: 400, headers, body: JSON.stringify({ error: 'Member id is required' }) };
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
