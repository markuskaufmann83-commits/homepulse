import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { AiAction, AiParseResponse, ShoppingCategory, MemberStatus, FeedPostType } from '../shared/types';

// Deterministic rule-based parser matching frontend
function parseGermanTextLocally(
  text: string,
  knownMembers: string[] = []
): AiAction[] {
  const actions: AiAction[] = [];
  const clean = text.trim();
  if (!clean) return actions;

  const subClauses = clean.split(/(?:\s+und\s+|\s*;\s*|\s*\.\s*)/i);

  const findAssignedPerson = (clause: string): string | undefined => {
    for (const name of knownMembers) {
      if (!name) continue;
      const regex = new RegExp(`\\b(?:für|von|mit|an)\\s+${name}\\b|\\b${name}\\b`, 'i');
      if (regex.test(clause)) {
        return name;
      }
    }
    return undefined;
  };

  for (const clause of subClauses) {
    const trimmed = clause.trim();
    if (!trimmed) continue;

    // 1. Status Update Command
    if (/heimweg|unterwegs|im büro|auf der arbeit|in der schule|zuhause|im urlaub|krank/i.test(trimmed)) {
      const assigned = findAssignedPerson(trimmed) || (knownMembers.length > 0 ? knownMembers[0] : 'Ich');
      let newStatus: MemberStatus = 'home';
      if (/heimweg|unterwegs/i.test(trimmed)) newStatus = 'away';
      else if (/büro|arbeit/i.test(trimmed)) newStatus = 'work';
      else if (/schule|uni/i.test(trimmed)) newStatus = 'school';
      else if (/urlaub/i.test(trimmed)) newStatus = 'vacation';

      actions.push({
        type: 'STATUS_UPDATE',
        memberName: assigned,
        newStatus,
        statusMessage: trimmed
      });
      continue;
    }

    // 2. Calendar Event Command
    if (/kalender|termin|geburtstag|meeting|treffen|training|zahnarzt|arzt|uhr|elternabend|filmabend|eintragen/i.test(trimmed)) {
      const today = new Date();
      const getLocalDateStr = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      let dateStr = getLocalDateStr(today);

      const tomorrowMatch = /morgen\b/i.test(trimmed);
      const dayAfterTomorrow = /übermorgen\b/i.test(trimmed);

      if (dayAfterTomorrow) {
        const d = new Date();
        d.setDate(d.getDate() + 2);
        dateStr = getLocalDateStr(d);
      } else if (tomorrowMatch) {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        dateStr = getLocalDateStr(d);
      } else {
        const weekdays = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag'];
        for (let i = 0; i < weekdays.length; i++) {
          if (new RegExp(`\\b${weekdays[i]}\\b`, 'i').test(trimmed)) {
            const currentDay = today.getDay();
            let diff = i - currentDay;
            if (diff <= 0) diff += 7;
            const targetDate = new Date();
            targetDate.setDate(today.getDate() + diff);
            dateStr = getLocalDateStr(targetDate);
            break;
          }
        }
      }

      let time: string | undefined = undefined;
      const timeMatch = trimmed.match(/(?:um\s*)?(\d{1,2})(?::(\d{2}))?\s*(?:uhr)?/i);
      if (timeMatch && (timeMatch[0].includes('uhr') || timeMatch[0].includes(':') || trimmed.includes('um '))) {
        const hours = timeMatch[1].padStart(2, '0');
        const mins = timeMatch[2] ? timeMatch[2] : '00';
        time = `${hours}:${mins}`;
      }

      let extractedTitle = trimmed
        .replace(/(?:trage|erstell[e]?|setz[e]?|plan[e]?|füge|merke|trag|mach[e]?|im kalender|in den kalender|als termin|als kalendereintrag|auf die liste|kalendereintrag|kalender|termin|ein)/gi, '')
        .replace(/(?:am|für)\s+(?:montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|morgen|übermorgen|heute|\d{1,2}\.\d{1,2}\.?)/gi, '')
        .replace(/(?:(?:\bum\s*)?\d{1,2}(?::\d{2})?\s*uhr\b|\bum\s*\d{1,2}(?::\d{2})?\b)/gi, '')
        .replace(/^(?:ein|den|das|einen|eines|zum|beim)\s+/i, '')
        .trim();

      for (const name of knownMembers) {
        extractedTitle = extractedTitle.replace(new RegExp(`(?:für|mit|von)\\s+${name}`, 'gi'), '').trim();
      }

      const title = extractedTitle.charAt(0).toUpperCase() + extractedTitle.slice(1);

      actions.push({
        type: 'CALENDAR_ADD',
        title: title || 'Neuer Termin',
        date: dateStr,
        time,
        assignedTo: findAssignedPerson(trimmed) || 'Alle'
      });
      continue;
    }

    // 3. Pinnwand / Feed Post Command
    if (/pinnwand|notiz|post|nachricht|schreib|sag allen/i.test(trimmed)) {
      const content = trimmed
        .replace(/(?:auf die pinnwand|an die pinnwand|als notiz|schreib[e]?|poste|sag allen)/gi, '')
        .trim();

      actions.push({
        type: 'FEED_POST',
        content: content || trimmed,
        postType: 'note',
        author: findAssignedPerson(trimmed) || (knownMembers.length > 0 ? knownMembers[0] : 'Ich')
      });
      continue;
    }

    // 4. Default: Shopping List Item Command
    const qtyMatch = trimmed.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|l|liter|flaschen?|packungen?|pck|stk|stück|dose[n]?)?/i);
    let quantity: number | undefined = undefined;
    let unit: string | undefined = undefined;

    if (qtyMatch) {
      quantity = parseFloat(qtyMatch[1].replace(',', '.'));
      unit = qtyMatch[2] ? qtyMatch[2].toLowerCase() : undefined;
    }

    let itemName = trimmed
      .replace(/(?:setz[e]?|kauf[e]?|besorg[e]?|füg[e]?|pack[e]?|schreib[e]?|hol[e]?|bring[e]?|auf die einkaufsliste|auf die liste|zur einkaufsliste|zum einkauf)/gi, '')
      .replace(/(\d+(?:[.,]\d+)?)\s*(?:kg|g|l|liter|flaschen?|packungen?|pck|stk|stück|dose[n]?)?/gi, '')
      .replace(/^(?:ein|eine|einen|das|die|der|etwas|noch|bitte)\s+/i, '')
      .trim();

    for (const name of knownMembers) {
      itemName = itemName.replace(new RegExp(`(?:für|von)\\s+${name}`, 'gi'), '').trim();
    }

    if (itemName) {
      const title = itemName.charAt(0).toUpperCase() + itemName.slice(1);
      let category: ShoppingCategory = 'Sonstiges';

      if (/milch|käse|butter|joghurt|quark|sahne|eier|fleisch|wurst|fisch/i.test(title)) category = 'Frische';
      else if (/apfel|äpfel|banane|salat|tomate|gurke|zwiebel|kartoffel|obst|gemüse/i.test(title)) category = 'Obst & Gemüse';
      else if (/brot|nudeln|reis|mehl|zucker|kaffee|tee|öl|salz|gewürz/i.test(title)) category = 'Vorrat';
      else if (/wasser|saft|bier|wein|cola|limonade|getränk/i.test(title)) category = 'Getränke';
      else if (/seife|shampoo|zahnpasta|toilettenpapier|waschmittel|putzmittel/i.test(title)) category = 'Drogerie';
      else if (/pizza|eis|spinat|pommes|tiefkühl/i.test(title)) category = 'Tiefkühl';

      actions.push({
        type: 'SHOPPING_ADD',
        item: title,
        category,
        quantity,
        unit,
        assignedTo: findAssignedPerson(trimmed)
      });
    }
  }

  return actions;
}

export async function aiParserHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-household-id'
  };

  if (req.method === 'OPTIONS') {
    return { status: 204, headers };
  }

  try {
    const body = (await req.json()) as { prompt: string; memberNames?: string[] };
    const prompt = (body.prompt || '').trim();
    const memberNames = body.memberNames || [];

    if (!prompt) {
      return { status: 400, headers, body: JSON.stringify({ error: 'Prompt is required' }) };
    }

    const actions = parseGermanTextLocally(prompt, memberNames);
    const response: AiParseResponse = {
      rawText: prompt,
      actions,
      summary: `${actions.length} Aktion(en) erkannt`,
      source: 'rule_based'
    };

    return { status: 200, headers, body: JSON.stringify(response) };
  } catch (error: any) {
    context.error('Error in aiParserHandler:', error);
    return { status: 500, headers, body: JSON.stringify({ error: error.message || 'Internal Server Error' }) };
  }
}

app.http('ai-parse', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'ai-parse',
  handler: aiParserHandler
});
