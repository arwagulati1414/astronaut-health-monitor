import type { ReactNode } from "react";
import type { NasaRisk } from "@/lib/nasa/hrr";
import type { MedicReply, Urgency } from "@/lib/types";

const URGENCY_LABEL: Record<Urgency, string> = {
  routine: "ROUTINE",
  elevated: "ELEVATED",
  critical: "CRITICAL",
};

export function AdviceCard({
  reply,
  nasa,
  onQuickReply,
  disabled,
}: {
  reply: MedicReply;
  nasa?: NasaRisk[];
  onQuickReply: (text: string) => void;
  disabled?: boolean;
}) {
  return (
    <article className={`advice advice-${reply.urgency}`}>
      <header className="advice-head">
        <span>URGENCY</span>
        <strong>{URGENCY_LABEL[reply.urgency]}</strong>
      </header>
      <p className="advice-summary">{reply.assessmentSummary}</p>
      <Section title="Immediate steps">
        <ol className="steps">
          {reply.immediateSteps.map((step, index) => (
            <li key={step}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{step}</p>
            </li>
          ))}
        </ol>
      </Section>
      <Section title="Vitals next">
        <ul>
          {reply.vitalsNext.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Section>
      <Section title="Red flags">
        <ul>
          {reply.redFlags.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Section>
      <Section title="Environment">
        <ul>
          {reply.environmentNotes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Section>
      <Section title="Kit — educational only">
        <ul>
          {reply.kitGuidance.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Section>
      {reply.followUpQuestion ? (
        <div className="follow-up">
          <p>{reply.followUpQuestion}</p>
          {reply.quickReplies?.length ? (
            <div className="replies">
              {reply.quickReplies.map((replyText) => (
                <button
                  key={replyText}
                  type="button"
                  disabled={disabled}
                  onClick={() => onQuickReply(replyText)}
                >
                  {replyText}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="follow-up closed">Continue these steps. Call again if a red flag appears.</p>
      )}
      {nasa?.length ? (
        <Section title="NASA risk context">
          <ul className="nasa-notes">
            {nasa.map((risk) => (
              <li key={risk.id}>
                <a href={risk.url} target="_blank" rel="noreferrer">
                  {risk.title}
                </a>
                <p>{risk.note}</p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      <footer>
        <span>{reply.source === "gemini" ? "SOURCE GEMINI" : "SOURCE OFFLINE RULES"}</span>
        <span>{reply.disclaimer}</span>
      </footer>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="advice-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
