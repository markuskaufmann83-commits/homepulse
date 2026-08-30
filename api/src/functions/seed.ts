import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { saveItem, queryItems, deleteItemById } from '../shared/db';
import { FamilyMember, ShoppingItem, CalendarEvent, FeedPost, SubscriptionStatus } from '../shared/types';

function getRelativeDateStr(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

export const SEED_MEMBERS: FamilyMember[] = [
  {
    id: 'mem_1',
    name: 'Mama Lisa',
    role: 'admin',
    avatar: '👩‍💼',
    color: '#EC4899',
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
    color: '#3B82F6',
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
    color: '#8B5CF6',
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
    color: '#10B981',
    status: 'home',
    statusMessage: 'Zuhause & Hausaufgaben',
    locationShared: true,
    updatedAt: new Date().toISOString()
  }
];

export const SEED_SHOPPING_ITEMS: ShoppingItem[] = [
  {
    id: 'shop_1',
    title: 'Bio-Eier (Freilandhaltung)',
    category: 'Frische',
    quantity: 10,
    unit: 'Stk',
    assignedMemberId: 'mem_2',
    completed: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'shop_2',
    title: 'Hafermilch Barista',
    category: 'Vorrat',
    quantity: 2,
    unit: 'L',
    assignedMemberId: 'mem_1',
    completed: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'shop_3',
    title: 'Äpfel (Gala / regional)',
    category: 'Obst & Gemüse',
    quantity: 1.5,
    unit: 'kg',
    assignedMemberId: 'mem_2',
    completed: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'shop_4',
    title: 'Vollkorn-Sauerteigbrot',
    category: 'Vorrat',
    quantity: 1,
    unit: 'Laib',
    assignedMemberId: 'mem_2',
    completed: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'shop_5',
    title: 'Sensitiv Zahnpasta',
    category: 'Drogerie',
    quantity: 2,
    unit: 'Tuben',
    assignedMemberId: 'mem_3',
    completed: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'shop_6',
    title: 'Mineralwasser Medium',
    category: 'Getränke',
    quantity: 1,
    unit: 'Kasten',
    assignedMemberId: 'mem_2',
    completed: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'shop_7',
    title: 'Bio-Blattspinat',
    category: 'Tiefkühl',
    quantity: 1,
    unit: 'Pck',
    assignedMemberId: 'mem_1',
    completed: true,
    completedBy: 'Mama Lisa',
    completedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  }
];

export const SEED_CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'cal_1',
    title: 'Fußballtraining Jonas',
    description: 'Sportplatz am Waldsee, Trinkflasche mitnehmen',
    date: getRelativeDateStr(1),
    time: '16:30',
    endTime: '18:00',
    location: 'Sportplatz Waldsee',
    assignedMemberIds: ['mem_4'],
    category: 'Freizeit',
    createdAt: new Date().toISOString()
  },
  {
    id: 'cal_2',
    title: 'Elternsprechtag Mia',
    description: 'Gespräch mit Frau Weber (Klassenlehrerin)',
    date: getRelativeDateStr(2),
    time: '17:30',
    endTime: '18:15',
    location: 'Goethe-Gymnasium Raum 204',
    assignedMemberIds: ['mem_1', 'mem_2'],
    category: 'Schule',
    createdAt: new Date().toISOString()
  },
  {
    id: 'cal_3',
    title: 'Zahnarzt Routine-Check',
    description: 'Halbjährliche Kontrolle',
    date: getRelativeDateStr(3),
    time: '09:00',
    endTime: '09:45',
    location: 'Zahnarztpraxis Dr. Schmidt',
    assignedMemberIds: ['mem_2'],
    category: 'Arzt',
    createdAt: new Date().toISOString()
  },
  {
    id: 'cal_4',
    title: 'Kindergeburtstag Felix',
    description: 'Geschenk ist bereits besorgt',
    date: getRelativeDateStr(4),
    time: '15:00',
    endTime: '18:30',
    location: 'Trampolinpark JumpMax',
    assignedMemberIds: ['mem_3', 'mem_4'],
    category: 'Freizeit',
    createdAt: new Date().toISOString()
  },
  {
    id: 'cal_5',
    title: 'Familien-Filmabend & Pizza',
    description: 'Gemeinsam neuen Animationsfilm schauen',
    date: getRelativeDateStr(5),
    time: '19:00',
    endTime: '21:30',
    location: 'Wohnzimmer',
    assignedMemberIds: ['all'],
    category: 'Familie',
    createdAt: new Date().toISOString()
  }
];

export const SEED_FEED_POSTS: FeedPost[] = [
  {
    id: 'post_1',
    authorId: 'mem_1',
    content: 'Essen steht im Kühlschrank (Gemüse-Lasagne) 🍝 Einfach kurz in die Mikrowelle stellen!',
    type: 'meal',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    pinned: true,
    reactions: {
      '❤️': ['mem_2', 'mem_3', 'mem_4'],
      '😋': ['mem_4']
    },
    comments: [
      {
        id: 'comm_1',
        authorId: 'mem_2',
        content: 'Super, danke Schatz! Bin um 18:30 daheim.',
        timestamp: new Date(Date.now() - 3600000).toISOString()
      }
    ]
  },
  {
    id: 'post_2',
    authorId: 'mem_2',
    content: 'Bin jetzt auf dem Heimweg von der Arbeit 🚗 Braucht noch jemand etwas Dringendes aus dem Supermarkt?',
    type: 'status',
    timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
    reactions: {
      '👍': ['mem_1']
    }
  },
  {
    id: 'post_3',
    authorId: 'mem_3',
    content: 'Habe heute eine 1 im Mathe-Test bekommen! 📚🎉',
    type: 'note',
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
    reactions: {
      '🎉': ['mem_1', 'mem_2', 'mem_4'],
      '❤️': ['mem_1', 'mem_2']
    }
  }
];

export async function seedDatabase() {
  for (const m of SEED_MEMBERS) {
    await saveItem('members', m);
  }
  for (const s of SEED_SHOPPING_ITEMS) {
    await saveItem('shopping', s);
  }
  for (const c of SEED_CALENDAR_EVENTS) {
    await saveItem('calendar', c);
  }
  for (const f of SEED_FEED_POSTS) {
    await saveItem('feed', f);
  }
}

export async function seedHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (req.method === 'OPTIONS') {
    return { status: 204, headers };
  }

  try {
    await seedDatabase();
    return {
      status: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'HomePulse Beispieldaten erfolgreich in Cosmos DB initialisiert!'
      })
    };
  } catch (error: any) {
    context.error('Error seeding database:', error);
    return {
      status: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Internal Server Error' })
    };
  }
}

app.http('seed', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'seed',
  handler: seedHandler
});
