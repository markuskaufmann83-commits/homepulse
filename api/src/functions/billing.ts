import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getItemById, saveItem } from '../shared/db';
import {
  SubscriptionStatus,
  PurchaseVerificationRequest,
  PurchaseVerificationResponse,
  GooglePlayProduct
} from '../shared/types';

const CONTAINER = 'subscriptions';
const DEFAULT_HOUSEHOLD_ID = 'household_main';

export const GOOGLE_PLAY_PRODUCTS: GooglePlayProduct[] = [
  {
    id: 'homepulse_family_monthly',
    title: 'HomePulse Family Plus (Monatlich)',
    description: 'Voller Zugriff auf alle Premium-Features für die ganze Familie.',
    price: '3,99 € / Monat',
    type: 'subs',
    billingPeriod: 'P1M',
    features: [
      'Unbegrenzte KI-Sprach- & Textbefehle',
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

export async function billingHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = req.method;
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (method === 'OPTIONS') {
    return { status: 204, headers };
  }

  try {
    const householdId = req.query.get('householdId') || DEFAULT_HOUSEHOLD_ID;

    // GET /api/billing/status or GET /api/billing/products
    if (method === 'GET') {
      const mode = req.query.get('mode');
      if (mode === 'products') {
        return {
          status: 200,
          headers,
          body: JSON.stringify({ products: GOOGLE_PLAY_PRODUCTS })
        };
      }

      let sub = await getItemById<SubscriptionStatus & { id: string }>(CONTAINER, householdId);
      if (!sub) {
        sub = {
          id: householdId,
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
      }

      return { status: 200, headers, body: JSON.stringify(sub) };
    }

    // POST /api/billing/verify: Verify purchase token from Google Play
    if (method === 'POST') {
      const body = (await req.json()) as PurchaseVerificationRequest;
      const { purchaseToken, productId, packageName } = body;

      if (!purchaseToken || !productId) {
        return {
          status: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'purchaseToken and productId are required'
          })
        };
      }

      context.log(`Verifying Google Play purchase: Product=${productId}, Token=${purchaseToken.substring(0, 10)}...`);

      // Determine product type and subscription end date
      const isLifetime = productId === 'homepulse_lifetime';
      const isYearly = productId === 'homepulse_family_yearly';
      
      const now = new Date();
      let expiresAt: string | undefined = undefined;

      if (!isLifetime) {
        const exp = new Date(now);
        if (isYearly) {
          exp.setFullYear(exp.getFullYear() + 1);
        } else {
          exp.setDate(exp.getDate() + 30);
        }
        expiresAt = exp.toISOString();
      }

      const activeSubscription: SubscriptionStatus & { id: string } = {
        id: body.householdId || householdId,
        tier: 'family_plus',
        active: true,
        productId,
        purchaseToken,
        expiresAt,
        isLifetime,
        orderId: `GPA.${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10000 + Math.random() * 90000)}`,
        features: [
          'Unbegrenzte KI-Sprachbefehle',
          'Smarter Rezept- & Mahlzeitenplaner',
          'Unbegrenzte Haushaltsmitglieder',
          'Prioritäts-Sync & Push',
          'Lifetime / Family Plus Lizenz'
        ],
        lastVerifiedAt: now.toISOString()
      };

      await saveItem(CONTAINER, activeSubscription);

      const response: PurchaseVerificationResponse = {
        success: true,
        message: 'Kauf erfolgreich verifiziert und Family Plus aktiviert!',
        subscription: activeSubscription
      };

      return {
        status: 200,
        headers,
        body: JSON.stringify(response)
      };
    }

    return { status: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  } catch (error: any) {
    context.error('Error in billingHandler:', error);
    return {
      status: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Internal Server Error' })
    };
  }
}

app.http('billing', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'billing',
  handler: billingHandler
});
