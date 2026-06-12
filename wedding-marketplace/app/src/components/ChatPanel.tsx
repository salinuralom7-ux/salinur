import { useCallback, useEffect, useRef, useState } from 'react';
import type { Message, SessionUser } from '../types';
import { listMessages, sendMessage, subscribeMessages } from '../lib/api';

export default function ChatPanel({ quotationId, user }: { quotationId: string; user: SessionUser }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(
    () => listMessages(quotationId).then(setMessages).catch(() => {}),
    [quotationId],
  );

  useEffect(() => {
    void refresh();
    const unsub = subscribeMessages(quotationId, () => void refresh());
    const poll = setInterval(() => void refresh(), 4000); // fallback when realtime is unavailable
    return () => { unsub(); clearInterval(poll); };
  }, [quotationId, refresh]);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [messages.length]);

  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await sendMessage(user, quotationId, text);
      setText('');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-box" ref={boxRef}>
        {messages.length === 0 && <p className="muted">No messages yet — say hello.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.senderId === user.id ? 'me' : 'them'}`}>
            {m.text}
          </div>
        ))}
      </div>
      <div className="chat-input">
        <input
          value={text}
          placeholder="Type a message…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void send(); }}
        />
        <button className="btn btn-maroon" disabled={busy} onClick={() => void send()}>➤</button>
      </div>
    </div>
  );
}
