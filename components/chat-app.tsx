"use client";

import { useEffect, useRef, useState } from "react";
import { AdviceCard } from "@/components/advice-card";
import { EyeCamera } from "@/components/eye-camera";
import { adviseOffline } from "@/lib/offline-engine";
import { ENVIRONMENTS, type Environment, type MedicReply } from "@/lib/types";

const GREETING_ID = "greeting";

type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  reply?: MedicReply;
  imageUrl?: string;
};

function greeting(): UiMessage {
  return {
    id: GREETING_ID,
    role: "assistant",
    content:
      "AHM online. Describe what is happening to the crewmate in your own words. I will answer with first-aid steps and one question at a time.",
  };
}

export function ChatApp() {
  const [environment, setEnvironment] = useState<Environment>("space-station");
  const [messages, setMessages] = useState<UiMessage[]>([greeting()]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [eyeHandoffLogged, setEyeHandoffLogged] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    thread.scrollTop = thread.scrollHeight;
  }, [messages, pending]);

  const lastAdviceId = [...messages].reverse().find((message) => message.reply)?.id;
  const lastReply = messages.find((message) => message.id === lastAdviceId)?.reply;

  async function submit(text: string, imageUrl?: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;

    const userMessage: UiMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      imageUrl,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft("");
    setPending(true);

    const history = nextMessages
      .filter((message) => message.id !== GREETING_ID)
      .filter((message) => message.role === "user" || message.reply)
      .map((message) => ({
        role: message.role,
        content: message.content,
        slot: message.reply?.slot ?? null,
      }));
    const payload = {
      environment,
      eyeHandoffLogged: eyeHandoffLogged || /eye handoff log/i.test(trimmed),
      history,
    };

    let reply: MedicReply;
    try {
      const response = await fetch("/api/medic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Medic link failed");
      reply = (await response.json()) as MedicReply;
      if (!reply?.urgency || !reply.immediateSteps) throw new Error("Bad payload");
    } catch {
      reply = adviseOffline(payload);
    }

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: reply.assessmentSummary,
        reply,
      },
    ]);
    setPending(false);
    inputRef.current?.focus();
  }

  function reset() {
    setMessages([greeting()]);
    setDraft("");
    setEyeHandoffLogged(false);
    setCameraOpen(false);
  }

  function onCapture(dataUrl: string) {
    setCameraOpen(false);
    setEyeHandoffLogged(true);
    const stamp = new Date().toISOString();
    void submit(
      `EYE HANDOFF LOG: still frame captured locally at ${stamp}. Experimental visual log for crew handoff only — not a pupil measurement and not a diagnosis.`,
      dataUrl,
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <p className="kicker">AHM-01 · FLIGHT MEDIC LINK</p>
          <h1>Astronaut Health Monitor</h1>
          <p className="disclaimer">
            Decision support only — not a diagnosis, not a licensed prescription, not an official
            NASA protocol.
          </p>
        </div>
        <div className="top-controls">
          <div className="env" role="radiogroup" aria-label="Vehicle environment">
            {ENVIRONMENTS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={environment === item.id}
                className={environment === item.id ? "on" : ""}
                onClick={() => setEnvironment(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="status-row">
            <span className={lastReply ? `dot dot-${lastReply.urgency}` : "dot"} />
            <span>
              {lastReply
                ? `${lastReply.urgency.toUpperCase()} · ${lastReply.source === "gemini" ? "GEMINI" : "OFFLINE"}`
                : "LINK READY"}
            </span>
            <button type="button" onClick={reset}>
              RESET
            </button>
          </div>
        </div>
      </header>

      <div className="thread" ref={threadRef} aria-live="polite">
        {messages.map((message) =>
          message.role === "user" ? (
            <div key={message.id} className="bubble user">
              <span className="who">CREW</span>
              <p>{message.content}</p>
              {message.imageUrl ? (
                // Data URLs from the local camera are not remote images.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={message.imageUrl} alt="Eye handoff still, not a clinical measurement" />
              ) : null}
            </div>
          ) : (
            <div key={message.id} className="bubble medic">
              <span className="who">MEDIC</span>
              {message.reply ? (
                <AdviceCard
                  reply={message.reply}
                  onQuickReply={(text) => void submit(text)}
                  disabled={pending || message.id !== lastAdviceId}
                />
              ) : (
                <p>{message.content}</p>
              )}
            </div>
          ),
        )}
        {pending ? <p className="pending">STANDING BY — CHECKING PROTOCOL</p> : null}
      </div>

      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(draft);
        }}
      >
        <label className="sr-only" htmlFor="symptom-input">
          Describe the emergency
        </label>
        <textarea
          id="symptom-input"
          ref={inputRef}
          rows={2}
          value={draft}
          placeholder="Describe symptoms, e.g. sudden chest pain on station, sweaty, short of breath"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit(draft);
            }
          }}
        />
        <button type="button" onClick={() => setCameraOpen(true)} aria-label="Open eye camera">
          CAM
        </button>
        <button type="submit" disabled={pending || !draft.trim()}>
          SEND
        </button>
      </form>

      {cameraOpen ? <EyeCamera onCapture={onCapture} onClose={() => setCameraOpen(false)} /> : null}
    </div>
  );
}
