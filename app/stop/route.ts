import { NextRequest } from 'next/server';
import { onRequest } from '@/agents/stop';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Next.js route for the stop handler.
 * The frontend posts to /stop; this bridges NextRequest
 * into the context shape that agents/stop expects.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const context = {
    request: {
      method: 'POST',
      body,
      signal: req.signal,
    },
    env: process.env as Record<string, string | undefined>,
    conversation_id:
      body.conversation_id ||
      req.headers.get('makers-conversation-id') ||
      '',
  };

  return onRequest(context);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, makers-conversation-id, Authorization',
    },
  });
}
