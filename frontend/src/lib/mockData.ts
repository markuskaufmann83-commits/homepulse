import {
  FamilyMember,
  ShoppingItem,
  CalendarEvent,
  FeedPost,
  SubscriptionStatus,
  GooglePlayProduct
} from './types';

// Clean initial data without mock items
export const INITIAL_MEMBERS: FamilyMember[] = [];
export const INITIAL_SHOPPING_ITEMS: ShoppingItem[] = [];
export const INITIAL_CALENDAR_EVENTS: CalendarEvent[] = [];
export const INITIAL_FEED_POSTS: FeedPost[] = [];

export const INITIAL_SUBSCRIPTION: SubscriptionStatus = {
  tier: 'free',
  active: true,
  features: [
    'Basis-Familienkalender',
    'Gemeinsame Einkaufsliste',
    'Familien-Feed & Pinnwand',
    '50 KI-Sprachbefehle pro Monat'
  ],
  lastVerifiedAt: new Date().toISOString()
};

export const PLAY_PRODUCTS: GooglePlayProduct[] = [
  {
    id: 'homepulse_family_monthly',
    title: 'HomePulse Family Plus (Monatlich)',
    description: 'Voller Zugriff auf alle Premium-Features für die ganze Familie.',
    price: '3,99 € / Monat',
    type: 'subs',
    billingPeriod: 'P1M',
    features: [
      'Unbegrenzte KI-Sprach- & Textbefehle',
      'Google / Gmail Kalender 2-Wege Synchronisation',
      'Smarter Rezept- & Mahlzeitenplaner',
      'Unbegrenzte Haushaltsmitglieder',
      'Automatische Push-Benachrichtigungen',
      'Echtzeit-Synchronisierung auf allen Geräten'
    ]
  },
  {
    id: 'homepulse_family_yearly',
    title: 'HomePulse Family Plus (Jährlich)',
    description: 'Spare über 30% mit dem Jahresabo für den gesamten Haushalt.',
    price: '29,99 € / Jahr',
    type: 'subs',
    billingPeriod: 'P1Y',
    features: [
      'Alle Vorteile von Family Plus',
      'Google Kalender Synchronisation',
      '30% Ersparnis gegenüber monatlicher Abrechnung',
      'Priorisierter KI-Server-Zugang',
      'Exklusive Familien-Widgets'
    ]
  },
  {
    id: 'homepulse_lifetime',
    title: 'HomePulse Lifetime Family Pass',
    description: 'Einmal zahlen, für immer werbefrei und unbegrenzt nutzen.',
    price: '69,99 € einmalig',
    type: 'inapp',
    billingPeriod: 'lifetime',
    features: [
      'Lebenslanger Zugriff ohne wiederkehrende Abokosten',
      'Alle zukünftigen Pro-Features inklusive',
      'VIP-Support für die Familie'
    ]
  }
];
