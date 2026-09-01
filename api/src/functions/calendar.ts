import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { queryItems, saveItem, deleteItemById } from '../shared/db';
import { CalendarEvent } from '../shared/types';

const CONTAINER = 'calendar';

function getHouseholdId(req: HttpRequest): string {
  return (
    req.headers.get('x-household-id') ||
    req.query.get('householdId') ||
    'default_household'
  );
}

export async function calendarHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
      // iCal proxy action for Google Calendar
      const action = req.query.get('action');
      if (action === 'sync-ical') {
        const url = req.query.get('url');
        if (!url) {
          return { status: 400, headers, body: JSON.stringify({ error: 'url is required' }) };
        }
        try {
          const icsRes = await fetch(url);
          if (icsRes.ok) {
            const icsText = await icsRes.text();
            return {
              status: 200,
              headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
              body: icsText
            };
          }
        } catch (e: any) {
          return { status: 502, headers, body: JSON.stringify({ error: `Failed to fetch iCal: ${e.message}` }) };
        }
      }

      const allItems = await queryItems<CalendarEvent>(CONTAINER);
      const filtered = allItems.filter(
        e => !e.householdId || e.householdId === householdId
      );

      // Sort by date and time
      filtered.sort((a, b) => {
        const dComp = a.date.localeCompare(b.date);
        if (dComp !== 0) return dComp;
        return (a.time || '').localeCompare(b.time || '');
      });
      return { status: 200, headers, body: JSON.stringify(filtered) };
    }

    if (method === 'POST') {
      const data = (await req.json()) as Partial<CalendarEvent>;
      if (!data.title || !data.date) {
        return { status: 400, headers, body: JSON.stringify({ error: 'Title and Date are required' }) };
      }

      const newEvent: CalendarEvent = {
        id: data.id || `cal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        householdId: data.householdId || householdId,
        title: data.title,
        description: data.description,
        date: data.date,
        time: data.time,
        endTime: data.endTime,
        location: data.location,
        assignedMemberIds: Array.isArray(data.assignedMemberIds) ? data.assignedMemberIds : ['all'],
        category: data.category || 'Familie',
        isAllDay: !!data.isAllDay,
        createdAt: data.createdAt || new Date().toISOString(),
        isGoogleSynced: !!data.isGoogleSynced,
        googleEventId: data.googleEventId,
        externalSource: data.externalSource || 'manual'
      };

      const saved = await saveItem<CalendarEvent>(CONTAINER, newEvent);
      return { status: 201, headers, body: JSON.stringify(saved) };
    }

    if (method === 'PUT') {
      const data = (await req.json()) as CalendarEvent;
      if (!data.id) {
        return { status: 400, headers, body: JSON.stringify({ error: 'Event id is required for update' }) };
      }

      data.householdId = data.householdId || householdId;
      const updated = await saveItem<CalendarEvent>(CONTAINER, data);
      return { status: 200, headers, body: JSON.stringify(updated) };
    }

    if (method === 'DELETE') {
      const id = req.query.get('id');
      if (!id) {
        return { status: 400, headers, body: JSON.stringify({ error: 'Event id query parameter is required' }) };
      }

      const deleted = await deleteItemById(CONTAINER, id);
      return { status: 200, headers, body: JSON.stringify({ success: deleted, id }) };
    }

    return { status: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  } catch (error: any) {
    context.error('Error in calendarHandler:', error);
    return { status: 500, headers, body: JSON.stringify({ error: error.message || 'Internal Server Error' }) };
  }
}

app.http('calendar', {
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'calendar',
  handler: calendarHandler
});
