import { NextRequest } from 'next/server';
import { onRequest } from '@/agents/chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Next.js route for the chat handler.
 * The frontend posts to /chat; this bridges NextRequest
 * into the { request, env, conversation_id } context shape
 * that agents/chat expects.
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
    // chat-panel.tsx sends the cid via this header (never in body)
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
