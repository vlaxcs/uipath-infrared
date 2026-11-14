import type { Project } from "~/onboarding/types";

const METRICS: Record<string, string> = {
  monthly_active_users: "MAU",
  daily_active_users: "DAU",
};

export function projectLabel(project: Project): string {
  return project.profile?.name || project.id;
}

export function projectFacts(project: Project): string | undefined {
  const profile = project.profile;
  if (!profile) return project.description || undefined;
  const facts = [profile.environments.join(", ")];
  if (profile.users) {
    const unit = METRICS[profile.users.metric] ?? "users";
    facts.push(`${profile.users.current.toLocaleString("en-US")} ${unit} now, ${profile.users.expected.toLocaleString("en-US")} expected at month ${profile.users.at_month}`);
  }
  if (profile.markets.length > 0) facts.push(profile.markets.join(", "));
  return `${profile.summary} ${facts.filter(Boolean).join(" · ")}`;
}
