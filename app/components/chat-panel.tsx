'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: true });

const GITHUB_URL = 'https://github.com/Gourab775/chat-workspace';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: { name: string; done?: boolean }[];
}

interface SiteConfig {
  name: string;
  welcome: string;
  suggestedQuestions: string[];
}

type Theme = 'dark' | 'light';

function applyTheme(theme: Theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  }
}

function MarkdownBlock({ content }: { content: string }) {
  const html = marked.parse(content) as string;
  return <div className="prose-chat" dangerouslySetInnerHTML={{ __html: html }} />;
}

function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M15.624 19.1084H12.3555L14.1338 7.04688H14.0654L10.0596 12.999H12.707L12.1963 15.7197H8.64258L6.45605 19.0898H2.52344L12.1963 4.4248H17.6104L15.624 19.1084ZM23.3555 4.41992L21.5371 19.1035H18.1094L19.9277 4.41992H23.3555Z" fill="currentColor" fillOpacity="0.9"/>
      <path d="M3.82795 3.43848L4.17716 4.38219C4.54277 5.37021 5.32177 6.14921 6.30981 6.51481L7.25355 6.86402L6.30981 7.21323C5.32177 7.57883 4.54277 8.35783 4.17716 9.34586L3.82795 10.2896L3.47874 9.34586C3.11313 8.35783 2.33412 7.57883 1.34609 7.21323L0.402344 6.86402L1.34609 6.51481C2.33412 6.14921 3.11313 5.37022 3.47874 4.38219L3.82795 3.43848Z" fill="currentColor" opacity="0.55"/>
    </svg>
  );
}

export default function ChatPanel({ mode = 'full' }: { mode?: 'full' | 'widget' }) {
  const [config, setConfig] = useState<SiteConfig>({ name: 'AI Chat Assistant', welcome: '', suggestedQuestions: [] });
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    return (localStorage.getItem('chat-theme') as Theme) || 'dark';
  });

  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem('chat-theme', theme); } catch {}
  }, [theme]);

  const [conversationId, setConversationId] = useState(() => {
    if (typeof window === 'undefined') return '';
    const key = 'ai-chat-assistant-cid';
    let cid = localStorage.getItem(key);
    if (!cid) {
      cid = crypto.randomUUID();
      localStorage.setItem(key, cid);
    }
    return cid;
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const composingRef = useRef(false);
  const pageContextRef = useRef<{ title?: string; url?: string; content?: string } | null>(null);

  // Load config
  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(c => {
        setConfig({
          name: c.name || 'AI Chat Assistant',
          welcome: c.welcome || '',
          suggestedQuestions: c.suggestedQuestions || [],
        });
      })
      .catch(() => {});
  }, []);

  // Listen for page context from parent window
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === '__aa_page_context' && e.data.payload) {
        pageContextRef.current = e.data.payload;
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  }, []);

  useEffect(scrollToBottom, [messages, scrollToBottom]);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || isStreaming) return;
    setInput('');
    setIsStreaming(true);

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: msg };
    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'makers-conversation-id': conversationId,
        },
        body: JSON.stringify({
          message: msg,
          ...(pageContextRef.current ? { pageContext: pageContextRef.current } : {}),
        }),
        signal: controller.signal,
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') break;
          try {
            const event = JSON.parse(payload);
            if (event.type === 'text_delta' && event.delta) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + event.delta } : m,
                ),
              );
            } else if (event.type === 'tool_call' && event.tool) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, toolCalls: [...(m.toolCalls || []), { name: event.tool }] }
                    : m,
                ),
              );
            } else if (event.type === 'tool_result' && event.tool) {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== assistantId || !m.toolCalls) return m;
                  const updated = m.toolCalls.map((tc) =>
                    tc.name === event.tool && !tc.done ? { ...tc, done: true } : tc,
                  );
                  return { ...m, toolCalls: updated };
                }),
              );
            } else if (event.type === 'error_message') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content || `Something went wrong: ${event.content}` }
                    : m,
                ),
              );
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content || 'Failed to connect. Please try again.' }
              : m,
          ),
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [input, isStreaming, conversationId]);

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    fetch('/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversationId }),
    }).catch(() => {});
  }, [conversationId]);

  const clearChat = useCallback(() => {
    setMessages([]);
    if (typeof window !== 'undefined') {
      // Rotate to a fresh conversation so server/DB history doesn't leak
      // into the new chat.
      const cid = crypto.randomUUID();
      localStorage.setItem('ai-chat-assistant-cid', cid);
      setConversationId(cid);
    }
  }, []);

  const isWidget = mode === 'widget';
  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;

  return (
    <div className={`flex flex-col ${isWidget ? 'h-full' : 'h-screen'} bg-white text-gray-900 dark:bg-[#212121] dark:text-gray-100`}>
      {/* Header */}
      <header className="relative flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-white/10">
        <div className="flex items-center gap-1">
          <button
            onClick={clearChat}
            title="New chat"
            aria-label="New chat"
            className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10 transition"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
          </button>
        </div>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold text-gray-700 dark:text-gray-200 max-w-[50%] truncate">
          {config.name}
        </h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
            className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10 transition"
          >
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
            )}
          </button>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub"
            aria-label="GitHub"
            className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10 transition"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          </a>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
              <div className="mb-5 text-gray-900 dark:text-white">
                <Logo size={44} />
              </div>
              <h2 className="text-2xl font-semibold mb-2">
                {config.welcome || 'What can I help with?'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md">
                Ask about this page or anything else — I will reply in your language.
              </p>
              {config.suggestedQuestions.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 max-w-xl">
                  {config.suggestedQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      className="px-4 py-2 rounded-full border border-gray-200 hover:bg-gray-50 text-sm text-gray-700 transition dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/10"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((msg) => (
                msg.role === 'user' ? (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[80%] rounded-3xl px-5 py-2.5 bg-[#f4f4f4] dark:bg-[#2f2f2f]">
                      <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ) : (
                  <div key={msg.id} className="flex gap-4">
                    <div className="w-8 h-8 rounded-full border border-gray-200 dark:border-white/15 flex items-center justify-center flex-shrink-0 mt-0.5 text-gray-700 dark:text-gray-200">
                      <Logo size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {msg.toolCalls.map((tc, i) => (
                            <span key={i} className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${tc.done ? 'text-green-700 border-green-200 bg-green-50 dark:text-green-300 dark:border-green-500/30 dark:bg-green-500/10' : 'text-gray-600 border-gray-200 bg-gray-50 dark:text-gray-300 dark:border-white/15 dark:bg-white/5'}`}>
                              {tc.done ? 'Checked' : 'Checking'} {tc.name}
                            </span>
                          ))}
                        </div>
                      )}
                      {msg.content ? (
                        <div className="text-[15px] leading-relaxed">
                          <MarkdownBlock content={msg.content} />
                          {isStreaming && msg.id === lastAssistantId && (
                            <span className="inline-block w-2 h-4 ml-1 align-middle bg-gray-500 dark:bg-gray-300 rounded-sm animate-pulse" />
                          )}
                        </div>
                      ) : (
                        <div className="flex gap-1 py-2">
                          <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      )}
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="px-4 pb-4 pt-2">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-[28px] border border-gray-200 bg-white shadow-sm transition focus-within:border-gray-300 dark:border-white/15 dark:bg-[#2f2f2f] dark:shadow-none dark:focus-within:border-white/25">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onCompositionStart={() => { composingRef.current = true; }}
              onCompositionEnd={() => { composingRef.current = false; }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !composingRef.current) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Message..."
              rows={1}
              className="w-full resize-none bg-transparent px-5 pt-4 pb-1 text-[15px] outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
              style={{ minHeight: '44px', maxHeight: '160px' }}
            />
            <div className="flex items-center justify-end px-3 pb-3">
              {isStreaming ? (
                <button
                  onClick={stopStream}
                  title="Stop"
                  aria-label="Stop generating"
                  className="p-2 rounded-full bg-black text-white hover:opacity-80 transition dark:bg-white dark:text-black"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                </button>
              ) : (
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim()}
                  title="Send"
                  aria-label="Send message"
                  className="p-2 rounded-full bg-black text-white disabled:opacity-20 disabled:cursor-not-allowed hover:opacity-80 transition dark:bg-white dark:text-black"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg>
                </button>
              )}
            </div>
          </div>
          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-2">
            AI can make mistakes. Check important info.
          </p>
        </div>
      </div>
    </div>
  );
}
