import { AiAction, ShoppingCategory, MemberStatus, FeedPostType } from './types';
import { formatLocalDate } from './dateUtils';

/**
 * Parses German date expressions from natural language text.
 * Supports DD.MM.YYYY, DD.MM.YY, DD.MM., named months (e.g. "5. September"),
 * relative keywords ("morgen", "übermorgen", "heute") and weekdays.
 */
export function parseGermanDate(text: string, referenceDate: Date = new Date()): string {
  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth() + 1;

  // 1. Explicit DD.MM.YYYY or DD.MM.YY (e.g. "05.09.26", "5.9.2026", "05.09.")
  const dateRegex = /\b(\d{1,2})\.(\d{1,2})\.(?:(\d{2,4}))?\b/;
  const dateMatch = text.match(dateRegex);
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10);
    let year = currentYear;
    if (dateMatch[3]) {
      const rawYear = parseInt(dateMatch[3], 10);
      year = rawYear < 100 ? 2000 + rawYear : rawYear;
    } else {
      if (month < currentMonth) year = currentYear + 1;
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // 2. Named month format (e.g. "5. September 2026", "15. Oktober", "1. Mai")
  const monthNames: Record<string, number> = {
    januar: 1, jan: 1,
    februar: 2, feb: 2,
    märz: 3, maerz: 3, mrz: 3,
    april: 4, apr: 4,
    mai: 5,
    juni: 6, jun: 6,
    juli: 7, jul: 7,
    august: 8, aug: 8,
    september: 9, sep: 9, sept: 9,
    oktober: 10, okt: 10,
    november: 11, nov: 11,
    dezember: 12, dez: 12
  };
  const namedMonthRegex = /\b(\d{1,2})\.?\s+(januar|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember|jan|feb|mrz|apr|jun|jul|aug|sep|sept|okt|nov|dez)(?:\s+(\d{2,4}))?\b/i;
  const namedMonthMatch = text.match(namedMonthRegex);
  if (namedMonthMatch) {
    const day = parseInt(namedMonthMatch[1], 10);
    const mStr = namedMonthMatch[2].toLowerCase();
    const month = monthNames[mStr] || currentMonth;
    let year = currentYear;
    if (namedMonthMatch[3]) {
      const rawYear = parseInt(namedMonthMatch[3], 10);
      year = rawYear < 100 ? 2000 + rawYear : rawYear;
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // 3. Relative keywords ("übermorgen", "morgen", "heute")
  if (/\bübermorgen\b/i.test(text)) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() + 2);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (/\bmorgen\b/i.test(text)) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // 4. Weekdays ("montag", "dienstag", ...)
  const weekdays = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag'];
  for (let i = 0; i < weekdays.length; i++) {
    if (new RegExp(`\\b${weekdays[i]}\\b`, 'i').test(text)) {
      const currentDay = referenceDate.getDay();
      let diff = i - currentDay;
      if (diff <= 0) diff += 7;
      const targetDate = new Date(referenceDate);
      targetDate.setDate(targetDate.getDate() + diff);
      return `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
    }
  }

  // Default: Today
  return `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, '0')}-${String(referenceDate.getDate()).padStart(2, '0')}`;
}

/**
 * German Natural Language Parser for Voice & Text Commands
 * Dynamically uses the household's actual family members
 */
export function parseGermanTextLocally(
  text: string,
  knownMembers: string[] = []
): AiAction[] {
  const actions: AiAction[] = [];
  const clean = text.trim();
  if (!clean) return actions;

  // Split multi-action phrases by "und", ";", "."
  const subClauses = clean.split(/(?:\s+und\s+|\s*;\s*|\s*\.\s*)/i);

  const findAssignedPerson = (clause: string): string | undefined => {
    if (/\b(?:uns\s+allen|für\s+uns\s+alle|für\s+alle|alle|jedem|ganze\s+familie)\b/i.test(clause)) {
      return 'Alle';
    }
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

    // 1. Status Update Command ("Bin auf dem Heimweg", "Papa ist im Büro", "komme nach Hause")
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

    // 2. Calendar Event Command ("Trage für morgen 15 Uhr Zahnarzttermin im Kalender ein", "trag uns allen eine Termin für den 05.09.26 für eine Kutsch")
    if (/kalender|termin|geburtstag|meeting|treffen|training|zahnarzt|arzt|uhr|elternabend|filmabend|eintragen|trag|trage|erstell|plane/i.test(trimmed)) {
      const dateStr = parseGermanDate(trimmed);

      // Time extraction ("um 15 Uhr", "15:30", "15 Uhr")
      let time: string | undefined = undefined;
      const timeMatch = trimmed.match(/(?:um\s*)?(\d{1,2})(?::(\d{2}))?\s*(?:uhr)?/i);
      if (timeMatch && (timeMatch[0].includes('uhr') || timeMatch[0].includes(':') || trimmed.includes('um '))) {
        const hours = timeMatch[1].padStart(2, '0');
        const mins = timeMatch[2] ? timeMatch[2] : '00';
        time = `${hours}:${mins}`;
      }

      // Title cleaning
      let extractedTitle = trimmed
        // Remove command verbs
        .replace(/(?:trage|erstell[e]?|setz[e]?|plan[e]?|füge|merke|trag|mach[e]?)/gi, '')
        // Remove target assignment phrases
        .replace(/(?:uns\s+allen|für\s+uns\s+alle|für\s+alle)/gi, '')
        // Remove date phrases
        .replace(/(?:am|für|für\s+den|am\s+den)\s+(?:\d{1,2}\.\d{1,2}\.(?:\d{2,4})?|\d{1,2}\.?\s+(?:januar|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember|jan|feb|mrz|apr|jun|jul|aug|sep|sept|okt|nov|dez)(?:\s+\d{2,4})?|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|morgen|übermorgen|heute)/gi, '')
        // Remove explicit date tokens if left
        .replace(/\b\d{1,2}\.\d{1,2}\.(?:\d{2,4})?\b/g, '')
        // Remove time tokens
        .replace(/(?:(?:\bum\s*)?\d{1,2}(?::\d{2})?\s*uhr\b|\bum\s*\d{1,2}(?::\d{2})?\b)/gi, '')
        // Remove calendar keywords
        .replace(/(?:im\s+kalender|in\s+den\s+kalender|als\s+termin|als\s+kalendereintrag|auf\s+die\s+liste|kalendereintrag|kalender|termin|ein)/gi, '')
        // Remove filler leading prepositions / articles
        .replace(/^(?:ein[en|es|e]?|den|das|die|der|zum|beim|für\s+ein[en|es|e]?|für)\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim();

      // Clean known member names from title
      for (const name of knownMembers) {
        extractedTitle = extractedTitle.replace(new RegExp(`(?:für|mit|von)\\s+${name}`, 'gi'), '').trim();
      }

      // Remove leftover leading/trailing prepositions
      extractedTitle = extractedTitle.replace(/^(?:für|an|mit|von|zu|bei)\s+/i, '').trim();

      const title = extractedTitle ? extractedTitle.charAt(0).toUpperCase() + extractedTitle.slice(1) : 'Neuer Termin';

      actions.push({
        type: 'CALENDAR_ADD',
        title,
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

    // 4. Default: Shopping List Item Command ("Kauf Milch", "Setze Brot auf die Liste")
    const qtyMatch = trimmed.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|l|liter|flaschen?|packungen?|pck|stk|stück|dose[n]?)?/i);
    let quantity: number | undefined = undefined;
    let unit: string | undefined = undefined;

    if (qtyMatch) {
      quantity = parseFloat(qtyMatch[1].replace(',', '.'));
      unit = qtyMatch[2] ? qtyMatch[2].toLowerCase() : undefined;
    }

    // Clean item name
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
