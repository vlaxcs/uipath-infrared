export type TrafficProfile = {
  requests_per_second: number;
  phase_seconds: number;
};

export const RATE_LIMITS = { min: 1, max: 200 } as const;
export const PHASE_LIMITS = { min: 5, max: 120 } as const;
export const DEFAULT_TRAFFIC: TrafficProfile = { requests_per_second: 10, phase_seconds: 15 };

const RATE = /(\d+(?:\.\d+)?)\s*(?:rps|req(?:uests)?\s*(?:\/|per)\s*s(?:ec(?:ond)?)?|requests?\s+a\s+second)/i;
const PHASE = /(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds?|m|min|mins|minutes?)\b(?!\s*(?:rps|req))/i;
const MULTIPLIER = /\b(\d+(?:\.\d+)?)\s*x\b|\b(double|triple)\b/i;

export type PromptReading = { profile: TrafficProfile; understood: string[]; unread: boolean };

export function readTrafficPrompt(text: string, current: TrafficProfile): PromptReading {
  const understood: string[] = [];
  let { requests_per_second: rate, phase_seconds: phase } = current;

  const rateMatch = RATE.exec(text);
  if (rateMatch) {
    rate = Math.round(Number(rateMatch[1]));
    understood.push(`${rate} requests/s`);
  } else {
    const multiplier = MULTIPLIER.exec(text);
    if (multiplier) {
      const factor = multiplier[1] ? Number(multiplier[1]) : multiplier[2].toLowerCase() === "double" ? 2 : 3;
      rate = Math.round(current.requests_per_second * factor);
      understood.push(`${factor}x the rate: ${rate} requests/s`);
    }
  }

  const phaseMatch = PHASE.exec(text.replace(RATE, ""));
  if (phaseMatch) {
    const value = Number(phaseMatch[1]);
    phase = phaseMatch[2].toLowerCase().startsWith("m") ? value * 60 : value;
    understood.push(`${phase} s per phase`);
  }

  return {
    profile: { requests_per_second: clamp(rate, RATE_LIMITS), phase_seconds: clamp(phase, PHASE_LIMITS) },
    understood,
    unread: understood.length === 0,
  };
}

function clamp(value: number, limits: { min: number; max: number }): number {
  return Math.min(limits.max, Math.max(limits.min, value));
}
