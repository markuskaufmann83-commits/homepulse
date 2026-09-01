import { CalendarEvent } from './types';
import { getActiveHouseholdId } from './storage';

/**
 * Lightweight RFC 5545 iCalendar (.ics) Parser and Generator for Google Calendar / Gmail Sync
 */

// Parse iCal Date string (e.g., 20260830T143000Z or 20260830 or TZID=Europe/Berlin:20260830T143000)
function parseIcsDate(dateStr: string): { date: string; time?: string; isAllDay: boolean } {
  const clean = dateStr.replace(/^(?:TZID=[^:]+:)?/, '').trim();

  // Full date-time: YYYYMMDDTHHMMSS...
  if (clean.includes('T')) {
    const [dPart, tPart] = clean.split('T');
    const year = dPart.substring(0, 4);
    const month = dPart.substring(4, 6);
    const day = dPart.substring(6, 8);
    const hours = tPart.substring(0, 2);
    const mins = tPart.substring(2, 4);

    return {
      date: `${year}-${month}-${day}`,
      time: `${hours}:${mins}`,
      isAllDay: false
    };
  }

  // Date only (All Day): YYYYMMDD
  if (clean.length >= 8) {
    const year = clean.substring(0, 4);
    const month = clean.substring(4, 6);
    const day = clean.substring(6, 8);
    return {
      date: `${year}-${month}-${day}`,
      isAllDay: true
    };
  }

  return {
    date: new Date().toISOString().split('T')[0],
    isAllDay: true
  };
}

/**
 * Parses raw .ics file text into CalendarEvent array
 */
export function parseIcs(icsText: string, assignedMemberId: string = 'all', householdId?: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const lines = icsText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const hhId = householdId || getActiveHouseholdId();

  // Unfold lines (lines starting with space or tab are continuations)
  const unfolded: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.substring(1);
    } else {
      unfolded.push(line);
    }
  }

  let inEvent = false;
  let currentEvent: Partial<CalendarEvent> = {};
  let uid = '';

  for (const line of unfolded) {
    const trimmed = line.trim();

    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {
        id: '',
        householdId: hhId,
        title: 'Termin',
        assignedMemberIds: [assignedMemberId],
        category: 'Freizeit',
        isGoogleSynced: true,
        externalSource: 'google_calendar',
        createdAt: new Date().toISOString()
      };
      uid = '';
      continue;
    }

    if (trimmed === 'END:VEVENT') {
      inEvent = false;
      if (currentEvent.title && currentEvent.date) {
        currentEvent.id = uid ? `gcal_${uid.replace(/[^a-zA-Z0-9_-]/g, '_')}` : `gcal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        currentEvent.householdId = hhId;
        events.push(currentEvent as CalendarEvent);
      }
      continue;
    }

    if (!inEvent) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.substring(0, colonIdx).toUpperCase();
    const value = trimmed.substring(colonIdx + 1).trim();

    // Summary / Title
    if (key === 'SUMMARY' || key.startsWith('SUMMARY;')) {
      currentEvent.title = value.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, ' ');
    }

    // Description
    if (key === 'DESCRIPTION' || key.startsWith('DESCRIPTION;')) {
      currentEvent.description = value.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, '\n');
    }

    // Location
    if (key === 'LOCATION' || key.startsWith('LOCATION;')) {
      currentEvent.location = value.replace(/\\,/g, ',').replace(/\\;/g, ';');
    }

    // UID
    if (key === 'UID' || key.startsWith('UID;')) {
      uid = value;
      currentEvent.googleEventId = value;
    }

    // DTSTART
    if (key === 'DTSTART' || key.startsWith('DTSTART')) {
      const parsed = parseIcsDate(value);
      currentEvent.date = parsed.date;
      currentEvent.time = parsed.time;
      currentEvent.isAllDay = parsed.isAllDay;
    }

    // DTEND
    if (key === 'DTEND' || key.startsWith('DTEND')) {
      const parsed = parseIcsDate(value);
      currentEvent.endTime = parsed.time;
    }
  }

  return events;
}

/**
 * Generates RFC 5545 iCalendar content from HomePulse events
 */
export function generateIcs(events: CalendarEvent[], calendarName: string = 'HomePulse Familienkalender'): string {
  const nowStr = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const eventBlocks = events.map(e => {
    const dtStamp = nowStr;
    const dateFormatted = e.date.replace(/-/g, '');
    let dtStart = '';
    let dtEnd = '';

    if (e.time) {
      const [h, m] = e.time.split(':');
      dtStart = `DTSTART:${dateFormatted}T${h}${m}00`;
      if (e.endTime) {
        const [eh, em] = e.endTime.split(':');
        dtEnd = `\nDTEND:${dateFormatted}T${eh}${em}00`;
      } else {
        const endHour = String(Math.min(23, parseInt(h, 10) + 1)).padStart(2, '0');
        dtEnd = `\nDTEND:${dateFormatted}T${endHour}${m}00`;
      }
    } else {
      dtStart = `DTSTART;VALUE=DATE:${dateFormatted}`;
    }

    return `BEGIN:VEVENT
UID:${e.id}@homepulse.family
DTSTAMP:${dtStamp}
${dtStart}${dtEnd}
SUMMARY:${(e.title || 'Termin').replace(/\n/g, ' ')}
DESCRIPTION:${(e.description || '').replace(/\n/g, '\\n')}
LOCATION:${(e.location || '').replace(/\n/g, ' ')}
CATEGORIES:${e.category || 'Familie'}
STATUS:CONFIRMED
END:VEVENT`;
  }).join('\n');

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//HomePulse//Familienkalender//DE
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:${calendarName}
X-WR-TIMEZONE:Europe/Berlin
${eventBlocks}
END:VCALENDAR`;
}

/**
 * Trigger file download of .ics in the browser
 */
export function downloadIcsFile(events: CalendarEvent[], filename: string = 'homepulse-kalender.ics') {
  if (typeof window === 'undefined') return;
  const icsContent = generateIcs(events);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
