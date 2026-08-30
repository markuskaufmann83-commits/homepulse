import { AiAction, ShoppingCategory, MemberStatus } from './types';
import { formatLocalDate } from './dateUtils';

export function parseGermanTextLocally(
  text: string,
  knownMembers: string[] = ['Papa', 'Mama', 'Mia', 'Jonas', 'Papa Thomas', 'Mama Lisa']
): AiAction[] {
  const actions: AiAction[] = [];
  const clean = text.trim();

  const findAssignedPerson = (clause: string): string | undefined => {
    for (const member of knownMembers) {
      const regex = new RegExp(`(?:für|von|mit|an)\\s+${member}`, 'i');
      if (regex.test(clause)) return member;
    }
    for (const member of knownMembers) {
      const regex = new RegExp(`\\b${member}\\b`, 'i');
      if (regex.test(clause)) return member;
    }
    return undefined;
  };

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

  // Split into clauses
  const subClauses = clean.split(/(?:\s+und\s+|\s*;\s*|\s*\.\s*)/i);

  for (const clause of subClauses) {
    const trimmed = clause.trim();
    if (!trimmed) continue;

    // 1. Calendar match (Trage ein / Kalendereintrag / Termin / Geburtstag / Meeting / Uhr / Training / Arzt...)
    if (/kalender|termin|geburtstag|meeting|treffen|training|zahnarzt|arzt|uhr|elternabend|filmabend|eintragen/i.test(trimmed)) {
      let title = 'Termin';
      let time = '12:00';
      const today = new Date();
      let targetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0);

      // Time match (e.g. "16 Uhr", "16:30", "16:00 Uhr", "um 9 Uhr")
      const timeMatch = trimmed.match(/(?:um\s*)?(\d{1,2})(?::(\d{2}))?\s*(?:uhr)?/i);
      if (timeMatch && (trimmed.toLowerCase().includes('uhr') || timeMatch[0].includes('um') || timeMatch[2])) {
        const hours = timeMatch[1].padStart(2, '0');
        const mins = timeMatch[2] || '00';
        if (parseInt(hours, 10) <= 24) {
          time = `${hours}:${mins}`;
        }
      }

      // Date match
      const dayNames = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag'];
      const matchedDay = dayNames.find(d => new RegExp(`\\b${d}\\b`, 'i').test(trimmed));

      if (matchedDay) {
        const targetDayIndex = dayNames.indexOf(matchedDay);
        const currentDayIndex = today.getDay();
        let daysToAdd = (targetDayIndex - currentDayIndex + 7) % 7;
        if (daysToAdd === 0 && !/heute/i.test(trimmed)) daysToAdd = 7;
        targetDate.setDate(today.getDate() + daysToAdd);
      } else if (/übermorgen/i.test(trimmed)) {
        targetDate.setDate(today.getDate() + 2);
      } else if (/morgen/i.test(trimmed)) {
        targetDate.setDate(today.getDate() + 1);
      } else if (/heute/i.test(trimmed)) {
        targetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0);
      }

      const dateStr = formatLocalDate(targetDate);

      // Extract Clean Title
      let extractedTitle = trimmed
        .replace(/(?:trage|erstell[e]?|setz[e]?|plan[e]?|füge|merke|trag|mach[e]?|im kalender|in den kalender|als termin|als kalendereintrag|auf die liste|kalendereintrag|kalender|termin)/gi, '')
        .replace(/(?:am|für)\s+(?:montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|morgen|übermorgen|heute|\d{1,2}\.\d{1,2}\.?)/gi, '')
        .replace(/(?:(?:\bum\s*)?\d{1,2}(?::\d{2})?\s*uhr\b|\bum\s*\d{1,2}(?::\d{2})?\b)/gi, '')
        .replace(/(?:für|mit|von)\s+(?:Papa|Mama|Mia|Jonas|Alle|Papa Thomas|Mama Lisa)/gi, '')
        .replace(/^(?:ein|den|das|einen|eines|zum|beim)\s+/i, '')
        .trim();

      if (extractedTitle.length > 1) {
        title = extractedTitle.charAt(0).toUpperCase() + extractedTitle.slice(1);
      } else if (/kindergeburtstag/i.test(trimmed)) {
        title = 'Kindergeburtstag';
      } else if (/fußball|fussball/i.test(trimmed)) {
        title = 'Fußballtraining';
      } else if (/zahnarzt/i.test(trimmed)) {
        title = 'Zahnarzttermin';
      } else if (/arzt/i.test(trimmed)) {
        title = 'Arzttermin';
      }

      actions.push({
        type: 'CALENDAR_ADD',
        title: title || 'Neuer Termin',
        date: dateStr,
        time,
        assignedTo: findAssignedPerson(trimmed) || 'Alle'
      });
      continue;
    }

    // 2. Shopping match
    if (/einkaufsliste|liste|kaufen|kauf|besorgen|mitbringen|bio-eier|hafermilch|eier|milch|brot|butter|äpfel|bananen|käse/i.test(trimmed)) {
      const assigned = findAssignedPerson(trimmed);
      let itemsString = trimmed
        .replace(/(?:setz[e]?|pack[e]?|schreib[e]?|füg[e]?|kauf[e]?|bring[e]?|bitte|noch)\s+/gi, '')
        .replace(/(?:auf die einkaufsliste|auf die liste|zum einkaufen|dazu|auf meine liste)/gi, '')
        .replace(/(?:für|von)\s+(?:Papa|Mama|Mia|Jonas|Papa Thomas|Mama Lisa)/gi, '')
        .replace(/^(?:mal|bitte|auch)\s+/i, '')
        .trim();

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
    if (/bin daheim|bin zuhause|auf dem heimweg|unterwegs|in der arbeit|im büro|in der schule/i.test(trimmed)) {
      let status: MemberStatus = 'home';
      if (/heimweg|unterwegs/i.test(trimmed)) status = 'away';
      if (/arbeit|büro/i.test(trimmed)) status = 'work';
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

  return actions;
}
