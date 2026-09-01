import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

export async function seedHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  return {
    status: 200,
    headers,
    body: JSON.stringify({
      success: true,
      message: 'HomePulse läuft im Produktiv-Modus mit Benutzer-Registrierung.'
    })
  };
}

app.http('seed', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'seed',
  handler: seedHandler
});
