import { z } from "zod";
import type { MedicReply } from "@/lib/types";

export const decisionSchema = z.object({
  urgency: z.enum(["LOW", "MODERATE", "HIGH", "CRITICAL"]),
  summary: z.string().min(1),
  questions_to_ask: z.array(z.string()),
  immediate_actions: z.array(z.string()).min(1),
  monitor: z.array(z.string()),
  escalate_to_ground: z.boolean(),
  escalation_reason: z.string().nullable(),
  equipment_to_use: z.array(z.string()),
  disclaimer: z.string().min(1),
});

export type DecisionSupport = z.infer<typeof decisionSchema>;

export function decisionFromMedic(reply: MedicReply): DecisionSupport {
  const urgency =
    reply.urgency === "critical" ? "CRITICAL" : reply.urgency === "elevated" ? "HIGH" : "LOW";
  const candidate = {
    urgency,
    summary: reply.assessmentSummary,
    questions_to_ask: reply.followUpQuestion ? [reply.followUpQuestion] : [],
    immediate_actions: reply.immediateSteps,
    monitor: reply.redFlags,
    escalate_to_ground: reply.urgency !== "routine",
    escalation_reason:
      reply.urgency === "routine" ? null : "Pattern is serious enough to keep ground control in the loop.",
    equipment_to_use: reply.kitGuidance,
    disclaimer: reply.disclaimer,
  };
  const parsed = decisionSchema.safeParse(candidate);
  if (parsed.success) return parsed.data;
  return {
    urgency: "HIGH",
    summary: reply.assessmentSummary || "Decision support is available. Vitals were not invented.",
    questions_to_ask: ["Where are you right now?"],
    immediate_actions: reply.immediateSteps.length
      ? reply.immediateSteps
      : ["Stay with the crewmate and call ground control."],
    monitor: reply.redFlags,
    escalate_to_ground: true,
    escalation_reason: "The structured reply could not be validated.",
    equipment_to_use: [],
    disclaimer: reply.disclaimer,
  };
}
