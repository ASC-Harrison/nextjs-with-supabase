"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { useSessionTimeout } from "@/lib/use-session-timeout";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const VAPID_PUBLIC =
  "BMSdz66vdOV6IRhh5ObmNo8hnU8YlznA3mTxP22SG1JmRrSEhyeurlf5g2qKezphEc76qAjfIkBD9vI2PY9PNJI";

type ChatMessage = {
  id: string;
  created_at: string;
  sender_id: string;
  sender_name: string;
  message: string;
};

const CSS = `
  *,*::before,*::after{box-sizing:border-box}
  body{margin:0;background:#0a0f1e;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif}
  .root{min-height:100vh;background:#0a0f1e;color:#f0f6ff;padding:12px 12px 24px}
  .wrap{width:100%;max-width:760px;margin:0 auto}
  .header{background:#162032;border:1px solid #1e3a5f;border-radius:18px;padding:14px;margin-bottom:10px}
  .header-top{display:flex;align-items:center;justify-content:space-between;gap:10px}
  .back{background:#1e2d42;border:1px solid #334155;border-radius:9px;color:#94a3b8;padding:8px 12px;font:700 12px inherit;cursor:pointer}
  .title{font-size:21px;font-weight:900;letter-spacing:-.4px}
  .sub{font-size:11px;color:#64748b;margin-top:3px}
  .status{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:4px 8px;font-size:10px;font-weight:800;white-space:nowrap}
  .status.live{background:rgba(16,185,129,.12);color:#6ee7b7;border:1px solid rgba(16,185,129,.3)}
  .status.wait{background:rgba(245,158,11,.12);color:#fcd34d;border:1px solid rgba(245,158,11,.3)}
  .status.off{background:rgba(239,68,68,.12);color:#fca5a5;border:1px solid rgba(239,68,68,.3)}
  .warning{background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);border-radius:11px;padding:9px 11px;color:#fcd34d;font-size:11px;line-height:1.4;margin-bottom:10px}
  .notify{display:flex;align-items:center;justify-content:space-between;gap:10px;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.25);border-radius:11px;padding:9px 11px;margin-bottom:10px}
  .notify-copy{font-size:11px;color:#93c5fd;line-height:1.35}
  .notify-button{border:1px solid rgba(59,130,246,.45);background:rgba(59,130,246,.2);color:#bfdbfe;border-radius:9px;padding:8px 10px;font:800 11px inherit;cursor:pointer;white-space:nowrap}
  .notify-button:disabled{opacity:.55;cursor:not-allowed}
  .notify-on{color:#6ee7b7;font-size:11px;font-weight:800;white-space:nowrap}
  .chat{height:min(62vh,560px);min-height:360px;background:#101827;border:1px solid #1e3a5f;border-radius:16px;padding:12px;overflow-y:auto;scroll-behavior:smooth}
  .loading,.empty{text-align:center;color:#475569;font-size:12px;padding:40px 12px}
  .row{display:flex;margin-bottom:10px}
  .row.mine{justify-content:flex-end}
  .bubble{max-width:84%;background:#1e2d42;border:1px solid #334155;border-radius:4px 14px 14px 14px;padding:8px 10px}
  .mine .bubble{background:#1d4ed8;border-color:#2563eb;border-radius:14px 4px 14px 14px}
  .sender{font-size:10px;font-weight:800;color:#93c5fd;margin-bottom:3px}
  .mine .sender{color:#bfdbfe}
  .message{font-size:14px;line-height:1.38;color:#f8fafc;white-space:pre-wrap;word-break:break-word}
  .time{font-size:9px;color:#64748b;margin-top:4px;text-align:right}
  .mine .time{color:#bfdbfe}
  .composer{background:#162032;border:1px solid #1e3a5f;border-radius:16px;padding:10px;margin-top:10px}
  .input-row{display:flex;gap:8px;align-items:flex-end}
  .input{flex:1;min-height:44px;max-height:120px;resize:vertical;background:#0f172a;border:1px solid #334155;border-radius:11px;color:#f0f6ff;padding:10px 11px;font:14px/1.35 inherit;outline:none}
  .input:focus{border-color:#3b82f6;box-shadow:0 0 0 2px rgba(59,130,246,.12)}
  .send{height:44px;min-width:76px;background:#3b82f6;border:none;border-radius:11px;color:white;font:800 13px inherit;cursor:pointer;padding:0 14px}
  .send:disabled{opacity:.45;cursor:not-allowed}
  .composer-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px;font-size:10px;color:#475569}
  .error{color:#fca5a5}
  @media(max-width:480px){.root{padding:8px}.header{padding:12px}.chat{height:55vh}.bubble{max-width:90%}.send{min-width:64px;padding:0 10px}.notify{align-items:flex-start;flex-direction:column}.notify-button{width:100%}}
`;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from([...atob(base64)].map(character => character.charCodeAt(0)));
}

export default function ChatPage() {
  const router = useRouter();
  useSessionTimeout();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userId, setUserId] = useState("");
  const [displayName, setDisplayName] = useState("Staff");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [connection, setConnection] = useState<"CONNECTING"|"LIVE"|"OFFLINE">("CONNECTING");
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  async function registerPushNotifications(
    accessToken: string,
    staffName: string,
    requestPermission: boolean
  ) {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error("Notifications are not supported on this device.");
    }

    let permission = Notification.permission;
    if (requestPermission && permission !== "granted") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") {
      throw new Error("Allow notifications in your phone settings to receive chat alerts.");
    }

    const registration = await navigator.serviceWorker.register("/sw.js");
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });
    }

    const response = await fetch("/api/push-subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + accessToken,
      },
      body: JSON.stringify({ subscription, staff_name: staffName }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) {
      throw new Error(result?.error || "Could not enable chat notifications.");
    }
    setPushEnabled(true);
  }

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function startChat() {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.replace("/login");
        return;
      }

      if (cancelled) return;
      const name =
        session.user.user_metadata?.full_name?.trim() ||
        session.user.email ||
        "Staff";
      setUserId(session.user.id);
      setDisplayName(name);

      if (
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        void registerPushNotifications(session.access_token, name, false).catch(notificationError => {
          console.error("Could not sync chat notifications:", notificationError);
        });
      }

      const { data, error: loadError } = await supabase
        .from("chat_messages")
        .select("id,created_at,sender_id,sender_name,message")
        .order("created_at", { ascending: false })
        .limit(100);

      if (cancelled) return;
      if (loadError) {
        setError("Could not load staff chat.");
      } else {
        setMessages(((data as ChatMessage[]) || []).reverse());
      }
      setLoading(false);

      channel = supabase
        .channel("asc-staff-chat")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages" },
          payload => {
            const incoming = payload.new as ChatMessage;
            setMessages(current => {
              if (current.some(message => message.id === incoming.id)) return current;
              return [...current, incoming].slice(-200);
            });
          }
        )
        .subscribe(status => {
          if (status === "SUBSCRIBED") setConnection("LIVE");
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setConnection("OFFLINE");
          else setConnection("CONNECTING");
        });
    }

    void startChat();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [router]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function enablePush() {
    if (pushLoading) return;
    setPushLoading(true);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Please sign in again.");
      await registerPushNotifications(
        data.session.access_token,
        displayName,
        true
      );
    } catch (notificationError: any) {
      setError(notificationError?.message || "Could not enable chat notifications.");
    } finally {
      setPushLoading(false);
    }
  }

  async function sendMessage() {
    const message = draft.trim();
    if (!message || sending) return;
    if (message.length > 1000) {
      setError("Messages are limited to 1,000 characters.");
      return;
    }

    setSending(true);
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error("Please sign in again.");

      const response = await fetch("/api/chat-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + sessionData.session.access_token,
        },
        body: JSON.stringify({ message }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Message failed to send.");
      }

      const sent = result.message as ChatMessage;
      setMessages(current =>
        current.some(item => item.id === sent.id)
          ? current
          : [...current, sent].slice(-200)
      );
      setDraft("");
    } catch (sendError: any) {
      setError(sendError?.message || "Message failed to send.");
    } finally {
      setSending(false);
    }
  }

  function formatTime(value: string) {
    return new Date(value).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <main className="root">
        <div className="wrap">
          <section className="header">
            <div className="header-top">
              <button className="back" onClick={() => router.push("/inventory")}>← Inventory</button>
              <div style={{flex:1,minWidth:0}}>
                <div className="title">💬 Staff Chat</div>
                <div className="sub">Signed in as {displayName}</div>
              </div>
              <div className={"status " + (connection === "LIVE" ? "live" : connection === "OFFLINE" ? "off" : "wait")}>
                {connection === "LIVE" ? "● LIVE" : connection === "OFFLINE" ? "● OFFLINE" : "● CONNECTING"}
              </div>
            </div>
          </section>

          <div className="warning">
            ⚠️ Staff communication only. Do not post patient names, dates of birth, medical-record numbers, photos, or other patient-identifying information.
          </div>

          <div className="notify">
            <div className="notify-copy">
              Chat alerts show the sender and a short preview, and open Staff Chat when tapped.
            </div>
            {pushEnabled ? (
              <div className="notify-on">🔔 Notifications On</div>
            ) : (
              <button className="notify-button" disabled={pushLoading} onClick={() => void enablePush()}>
                {pushLoading ? "Enabling…" : "🔔 Enable Chat Notifications"}
              </button>
            )}
          </div>

          <section className="chat" aria-live="polite">
            {loading ? (
              <div className="loading">Loading staff chat…</div>
            ) : messages.length === 0 ? (
              <div className="empty">No messages yet. Start the conversation.</div>
            ) : (
              messages.map(item => {
                const mine = item.sender_id === userId;
                return (
                  <div key={item.id} className={"row " + (mine ? "mine" : "")}>
                    <div className="bubble">
                      <div className="sender">{mine ? "You" : item.sender_name}</div>
                      <div className="message">{item.message}</div>
                      <div className="time">{formatTime(item.created_at)}</div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={endRef} />
          </section>

          <section className="composer">
            <div className="input-row">
              <textarea
                className="input"
                value={draft}
                maxLength={1000}
                placeholder="Message staff…"
                aria-label="Staff chat message"
                onChange={event => setDraft(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
              />
              <button className="send" disabled={sending || !draft.trim()} onClick={() => void sendMessage()}>
                {sending ? "…" : "Send"}
              </button>
            </div>
            <div className="composer-foot">
              <span className={error ? "error" : ""}>{error || "Enter sends · Shift+Enter adds a new line"}</span>
              <span>{draft.length}/1000</span>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
