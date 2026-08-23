import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { AiAction, AiParseResponse, ShoppingCategory, MemberStatus } from '../shared/types';

// Intelligent deterministic fallback NLP parser for German voice/text commands
function parseGermanTextLocally(text: string, knownMembers: string[] = ['Papa', 'Mama', 'Mia', 'Jonas']): AiAction[] {
  const actions: AiAction[] = [];
  const clean = text.trim();

  // Helper to extract assigned person if mentioned
  const findAssignedPerson = (clause: string): string | undefined => {
    for (const member of knownMembers) {
      const regex = new RegExp(`(?:für|von|mit|an)\\s+${member}`, 'i');
      if (regex.test(clause)) return member;
    }
    // Also check if member name is mentioned directly
    for (const member of knownMembers) {
      const regex = new RegExp(`\\b${member}\\b`, 'i');
      if (regex.test(clause)) return member;
    }
    return undefined;
  };

  // Helper to categorize shopping items
  const categorizeItem = (name: string): ShoppingCategory => {
    const lower = name.toLowerCase();
    if (/milch|käse|joghurt|butter|quark|sahne|eier|bio-eier|tofu|fleisch|wurst|schinken/i.test(lower)) return 'Frische';
    if (/apfel|äpfel|banane|bananen|salat|gurke|tomate|tomaten|zwiebel|karotten|kartoffeln|beeren/i.test(lower)) return 'Obst & Gemüse';
    if (/brot|mehl|zucker|nudeln|pasta|reis|haferflocken|müsli|öl|olivenöl|konserve|sauce/i.test(lower)) return 'Vorrat';
    if (/shampoo|seife|zahnpasta|toilettenpapier|spülmittel|waschmittel|deo|taschentücher/i.test(lower)) return 'Drogerie';
    if (/wasser|saft|cola|bier|wein|kaffee|tee|sprudel/i.test(lower)) return 'Getränke';
    if (/pizza|eis|spinat|tiefkühl|pommes/i.test(lower)) return 'Tiefkühl';
    return 'Sonstiges';
  };

  // Split into clauses (by "und", "sowie", "außerdem", commas, or sentence end)
  // Check for calendar triggers
  const calendarRegex = /(?:trage|erstell[e]?|setz[e]?|plan[e]?|füge|merke|trag)\s+(?:für|am)?\s*(.*?)(?:in den kalender|im kalender|als termin|als kalendereintrag)/i;
  const directDateRegex = /(?:am|für)\s+(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|morgen|übermorgen|\d{1,2}\.\d{1,2}\.?|\d{4}-\d{2}-\d{2})\s*(?:um\s*(\d{1,2}(?::\d{2}|(?:\s*uhr))))?\s*(?:den\s*termin|das\s*event)?\s*(.*?)(?:im kalender|in den kalender|$)/i;

  // Check for shopping triggers
  const shoppingListRegex = /(?:setz[e]?|pack[e]?|schreib[e]?|füg[e]?|kauf[e]?|bring[e]?)\s+(.*?)\s+(?:auf die einkaufsliste|auf die liste|zum einkaufen|ein)/i;

  // Let's analyze clauses
  const subClauses = clean.split(/(?:\s+und\s+|\s*;\s*|\s*\.\s*)/i);

  for (const clause of subClauses) {
    const trimmed = clause.trim();
    if (!trimmed) continue;

    // 1. Calendar match
    if (/kalender|termin|geburtstag|uhr|treffen|training|zahnarzt|arzt/i.test(trimmed)) {
      let title = 'Termin';
      let time = '12:00';
      let date = new Date().toISOString().split('T')[0];

      // Time match (e.g., "16 Uhr", "16:30", "16:00 Uhr")
      const timeMatch = trimmed.match(/(\d{1,2})(?::(\d{2}))?\s*(?:uhr)?/i);
      if (timeMatch) {
        const hours = timeMatch[1].padStart(2, '0');
        const mins = timeMatch[2] || '00';
        time = `${hours}:${mins}`;
      }

      // Date match (e.g. freitag, morgen, etc.)
      const today = new Date();
      const dayNames = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag'];
      const matchedDay = dayNames.find(d => new RegExp(`\\b${d}\\b`, 'i').test(trimmed));

      if (matchedDay) {
        const targetDayIndex = dayNames.indexOf(matchedDay);
        const currentDayIndex = today.getDay();
        let daysToAdd = (targetDayIndex - currentDayIndex + 7) % 7;
        if (daysToAdd === 0) daysToAdd = 7; // Next week if same day
        const targetDate = new Date();
        targetDate.setDate(today.getDate() + daysToAdd);
        date = targetDate.toISOString().split('T')[0];
      } else if (/übermorgen/i.test(trimmed)) {
        const d = new Date();
        d.setDate(today.getDate() + 2);
        date = d.toISOString().split('T')[0];
      } else if (/morgen/i.test(trimmed)) {
        const d = new Date();
        d.setDate(today.getDate() + 1);
        date = d.toISOString().split('T')[0];
      }

      // Extract title: remove keywords
      let extractedTitle = trimmed
        .replace(/(?:trage|erstell[e]?|setz[e]?|plan[e]?|füge|merke|trag|im kalender|in den kalender|als termin|als kalendereintrag|auf die liste)/gi, '')
        .replace(/(?:am|für)\s+(?:montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|morgen|übermorgen|\d{1,2}\.\d{1,2}\.?)/gi, '')
        .replace(/(?:um\s*\d{1,2}(?::\d{2})?\s*(?:uhr)?)/gi, '')
        .replace(/(?:für|mit|von)\s+(?:Papa|Mama|Mia|Jonas|Alle)/gi, '')
        .replace(/^(?:ein|den|das|einen)\s+/i, '')
        .trim();

      if (extractedTitle.length > 1) {
        title = extractedTitle.charAt(0).toUpperCase() + extractedTitle.slice(1);
      } else if (/kindergeburtstag/i.test(trimmed)) {
        title = 'Kindergeburtstag';
      }

      actions.push({
        type: 'CALENDAR_ADD',
        title: title || 'Neuer Termin',
        date,
        time,
        assignedTo: findAssignedPerson(trimmed) || 'Alle'
      });
      continue;
    }

    // 2. Shopping match
    if (/einkaufsliste|liste|kaufen|besorgen|mitbringen|bio-eier|hafermilch|eier|milch|brot|butter/i.test(trimmed)) {
      const assigned = findAssignedPerson(trimmed);
      let itemsString = trimmed
        .replace(/(?:setz[e]?|pack[e]?|schreib[e]?|füg[e]?|kauf[e]?|bring[e]?|bitte|noch)\s+/gi, '')
        .replace(/(?:auf die einkaufsliste|auf die liste|zum einkaufen|dazu|auf meine liste)/gi, '')
        .replace(/(?:für|von)\s+(?:Papa|Mama|Mia|Jonas)/gi, '')
        .replace(/^(?:mal|bitte|auch)\s+/i, '')
        .trim();

      // Split multiple items (e.g. "Bio-Eier, Hafermilch und Brot")
      const rawItems = itemsString.split(/(?:,|\s+und\s+|\s+sowie\s+)/i);
      for (const rawItem of rawItems) {
        const itemClean = rawItem.replace(/^(?:den|das|die|ein|eine|einen|2|3|4|10|packung|liter|kg|flasche|dose)\s+/i, '').trim();
        if (itemClean.length > 1 && !/^(liste|einkaufen)$/i.test(itemClean)) {
          const capitalized = itemClean.charAt(0).toUpperCase() + itemClean.slice(1);
          actions.push({
            type: 'SHOPPING_ADD',
            item: capitalized,
            category: categorizeItem(capitalized),
            assignedTo: assigned || 'Papa'
          });
        }
      }
      continue;
    }

    // 3. Status update
    if (/bin daheim|bin zuhause|auf dem heimweg|unterwegs|in der arbeit|in der schule/i.test(trimmed)) {
      let status: MemberStatus = 'home';
      if (/heimweg|unterwegs/i.test(trimmed)) status = 'away';
      if (/arbeit/i.test(trimmed)) status = 'work';
      if (/schule/i.test(trimmed)) status = 'school';

      actions.push({
        type: 'STATUS_UPDATE',
        memberName: findAssignedPerson(trimmed) || 'Papa',
        newStatus: status,
        statusMessage: trimmed
      });
      continue;
    }

    // 4. Feed note fallback
    if (trimmed.length > 5) {
      actions.push({
        type: 'FEED_POST',
        content: trimmed,
        postType: 'note',
        author: findAssignedPerson(trimmed) || 'Familie'
      });
    }
  }

  // Fallback if no specific action was found but text exists
  if (actions.length === 0 && clean.length > 0) {
    actions.push({
      type: 'SHOPPING_ADD',
      item: clean.charAt(0).toUpperCase() + clean.slice(1),
      category: categorizeItem(clean),
      assignedTo: 'Alle'
    });
  }

  return actions;
}

// Call Gemini API if GEMINI_API_KEY is present
async function parseWithGemini(promptText: string, apiKey: string): Promise<AiAction[] | null> {
  try {
    const systemInstruction = `Du bist der KI-Assistent der Haushalts- und Familien-App "HomePulse".
Analysiere die Spracheingabe des Nutzers und extrahiere alle Aktionen als striktes JSON-Array.
Mögliche Aktionstypen:
1. SHOPPING_ADD: { "type": "SHOPPING_ADD", "item": string, "category": "Frische" | "Vorrat" | "Obst & Gemüse" | "Drogerie" | "Getränke" | "Tiefkühl" | "Sonstiges", "quantity": number (optional), "unit": string (optional), "assignedTo": string (Name oder "Alle") }
2. CALENDAR_ADD: { "type": "CALENDAR_ADD", "title": string, "date": "YYYY-MM-DD", "time": "HH:mm", "endTime": "HH:mm" (optional), "assignedTo": string (z.B. "Papa", "Mama", "Alle"), "location": string (optional) }
3. FEED_POST: { "type": "FEED_POST", "content": string, "postType": "status" | "note" | "alert" | "meal", "author": string }
4. STATUS_UPDATE: { "type": "STATUS_UPDATE", "memberName": string, "newStatus": "home" | "away" | "work" | "school" | "vacation", "statusMessage": string }

Heutiges Datum: ${new Date().toISOString().split('T')[0]}.
Antworte NUR mit dem reinen JSON-Array ohne Markdown-Formatierung oder Erklärungen.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: systemInstruction },
              { text: `Benutzereingabe: "${promptText}"` }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      console.warn('Gemini API returned error status:', response.status);
      return null;
    }

    const data: any = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) return null;

    const parsed = JSON.parse(candidateText.trim());
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return null;
  }
}

// Call OpenAI API if OPENAI_API_KEY is present
async function parseWithOpenAI(promptText: string, apiKey: string): Promise<AiAction[] | null> {
  try {
    const url = 'https://api.openai.com/v1/chat/completions';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Du bist der KI-Assistent für HomePulse. Extrahiere Aktionen aus dem Text und gib ein JSON-Objekt mit dem Feld "actions" zurück, das ein Array von Aktionen enthält (SHOPPING_ADD, CALENDAR_ADD, FEED_POST, STATUS_UPDATE). Heutiges Datum: ${new Date().toISOString().split('T')[0]}.`
          },
          { role: 'user', content: promptText }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) return null;
    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    return Array.isArray(parsed.actions) ? parsed.actions : (Array.isArray(parsed) ? parsed : null);
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    return null;
  }
}

export async function aiParserHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = (await req.json()) as { prompt?: string; memberNames?: string[] };
    const prompt = body?.prompt?.trim();

    if (!prompt) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Prompt is required' })
      };
    }

    let actions: AiAction[] | null = null;
    let source: 'gemini' | 'openai' | 'rule_based' = 'rule_based';

    // 1. Try Gemini
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && !geminiKey.includes('your-gemini')) {
      actions = await parseWithGemini(prompt, geminiKey);
      if (actions && actions.length > 0) {
        source = 'gemini';
      }
    }

    // 2. Try OpenAI if Gemini was not available/failed
    if (!actions) {
      const openAiKey = process.env.OPENAI_API_KEY;
      if (openAiKey && !openAiKey.includes('your-openai')) {
        actions = await parseWithOpenAI(prompt, openAiKey);
        if (actions && actions.length > 0) {
          source = 'openai';
        }
      }
    }

    // 3. Deterministic Local Rule-based NLP Parser Fallback
    if (!actions || actions.length === 0) {
      actions = parseGermanTextLocally(prompt, body.memberNames);
      source = 'rule_based';
    }

    const summary = `${actions.length} ${actions.length === 1 ? 'Aktion' : 'Aktionen'} erkannt`;

    const response: AiParseResponse = {
      rawText: prompt,
      actions,
      summary,
      source
    };

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify(response)
    };
  } catch (error: any) {
    context.error('Error in aiParserHandler:', error);
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error?.message || 'Internal Server Error' })
    };
  }
}

app.http('aiParser', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'ai-parse',
  handler: aiParserHandler
});
