/**
 * Postgres persistence for chat history (Neon).
 *
 * Graceful-degradation design:
 *   - If DATABASE_URL is unset, every function becomes a no-op (or returns
 *     null/[]) so the app keeps working with in-memory history only.
 *   - Uses @neondatabase/serverless HTTP client — no pooling, works in
 *     serverless/edge runtimes, one query per call.
 */
import { neon } from '@neondatabase/serverless';
import type { ChatMessage } from './_shared';
import { createLogger } from './_shared';

const logger = createLogger('db');

type Sql = ReturnType<typeof neon>;

let _sql: Sql | null = null;
let _initAttempted = false;

function getSql(env: Record<string, string | undefined>): Sql | null {
  if (_initAttempted) return _sql;
  _initAttempted = true;
  const url = env.DATABASE_URL;
  if (!url) {
    logger.log('[db] DATABASE_URL not set — using in-memory history only');
    return null;
  }
  try {
    _sql = neon(url);
    return _sql;
  } catch (e) {
    logger.error('[db] failed to init client:', (e as Error).message);
    return null;
  }
}

export function isDbConfigured(env: Record<string, string | undefined>): boolean {
  return !!env.DATABASE_URL;
}

function toText(content: ChatMessage['content']): string {
  return typeof content === 'string' ? content : JSON.stringify(content);
}

function toMessage(row: any): ChatMessage {
  const msg: ChatMessage = {
    role: row.role,
    content: row.content ?? '',
  };
  if (row.tool_call_id) msg.tool_call_id = row.tool_call_id;
  if (row.tool_calls) {
    try {
      msg.tool_calls = typeof row.tool_calls === 'string' ? JSON.parse(row.tool_calls) : row.tool_calls;
    } catch {
      // ignore malformed tool_calls
    }
  }
  return msg;
}

/** Load the last `limit` messages for a conversation, oldest-first. */
export async function loadHistory(
  env: Record<string, string | undefined>,
  conversationId: string,
  limit = 20,
): Promise<ChatMessage[] | null> {
  const sql = getSql(env);
  if (!sql || !conversationId) return null;
  try {
    const rows = await sql`
      SELECT role, content, tool_calls, tool_call_id FROM messages
      WHERE conversation_id = ${conversationId}
      ORDER BY id DESC LIMIT ${limit}`;
    return (rows as any[]).reverse().map(toMessage);
  } catch (e) {
    logger.error('[db] loadHistory failed:', (e as Error).message);
    return null;
  }
}

/** Append one message to the conversation (creates the conversation row if needed). */
export async function saveMessage(
  env: Record<string, string | undefined>,
  conversationId: string,
  msg: ChatMessage,
): Promise<void> {
  const sql = getSql(env);
  if (!sql || !conversationId) return;
  try {
    await sql`INSERT INTO conversations (id) VALUES (${conversationId})
      ON CONFLICT (id) DO UPDATE SET updated_at = now()`;
    await sql`
      INSERT INTO messages (conversation_id, role, content, tool_calls, tool_call_id)
      VALUES (${conversationId}, ${msg.role}, ${toText(msg.content)},
        ${msg.tool_calls ? JSON.stringify(msg.tool_calls) : null},
        ${msg.tool_call_id ?? null})`;
    // Keep only the latest 100 messages per conversation
    await sql`
      DELETE FROM messages WHERE conversation_id = ${conversationId} AND id NOT IN (
        SELECT id FROM messages WHERE conversation_id = ${conversationId}
        ORDER BY id DESC LIMIT 100)`;
  } catch (e) {
    logger.error('[db] saveMessage failed:', (e as Error).message);
  }
}
