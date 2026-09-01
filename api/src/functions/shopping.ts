import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { queryItems, saveItem, deleteItemById } from '../shared/db';
import { ShoppingItem } from '../shared/types';

const CONTAINER = 'shopping';

function getHouseholdId(req: HttpRequest): string {
  return (
    req.headers.get('x-household-id') ||
    req.query.get('householdId') ||
    'default_household'
  );
}

export async function shoppingHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
      const allItems = await queryItems<ShoppingItem>(CONTAINER);
      const filtered = allItems.filter(
        i => i.householdId === householdId
      );
      return { status: 200, headers, body: JSON.stringify(filtered) };
    }

    if (method === 'POST') {
      const data = (await req.json()) as Partial<ShoppingItem>;
      if (!data.title) {
        return { status: 400, headers, body: JSON.stringify({ error: 'Title is required' }) };
      }

      const now = new Date().toISOString();
      const newItem: ShoppingItem = {
        id: data.id || `shop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        householdId: data.householdId || householdId,
        title: data.title,
        category: data.category || 'Sonstiges',
        quantity: data.quantity,
        unit: data.unit,
        assignedMemberId: data.assignedMemberId,
        completed: !!data.completed,
        completedBy: data.completedBy,
        completedAt: data.completedAt,
        createdAt: data.createdAt || now,
        updatedAt: data.updatedAt || now
      };

      const saved = await saveItem<ShoppingItem>(CONTAINER, newItem);
      return { status: 201, headers, body: JSON.stringify(saved) };
    }

    if (method === 'PUT') {
      const data = (await req.json()) as ShoppingItem;
      if (!data.id) {
        return { status: 400, headers, body: JSON.stringify({ error: 'Item id is required for update' }) };
      }

      data.householdId = data.householdId || householdId;
      data.updatedAt = new Date().toISOString();
      const updated = await saveItem<ShoppingItem>(CONTAINER, data);
      return { status: 200, headers, body: JSON.stringify(updated) };
    }

    if (method === 'DELETE') {
      const action = req.query.get('action');
      if (action === 'clear_completed') {
        const items = await queryItems<ShoppingItem>(CONTAINER);
        for (const it of items) {
          if (it.completed && (!it.householdId || it.householdId === householdId)) {
            await deleteItemById(CONTAINER, it.id);
          }
        }
        return { status: 200, headers, body: JSON.stringify({ success: true, action: 'clear_completed' }) };
      }

      const id = req.query.get('id');
      if (!id) {
        return { status: 400, headers, body: JSON.stringify({ error: 'Item id query parameter is required' }) };
      }

      const deleted = await deleteItemById(CONTAINER, id);
      return { status: 200, headers, body: JSON.stringify({ success: deleted, id }) };
    }

    return { status: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  } catch (error: any) {
    context.error('Error in shoppingHandler:', error);
    return { status: 500, headers, body: JSON.stringify({ error: error.message || 'Internal Server Error' }) };
  }
}

app.http('shopping', {
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'shopping',
  handler: shoppingHandler
});
