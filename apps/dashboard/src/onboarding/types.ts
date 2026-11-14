export type Connection = {
  id: string;
  label: string;
  endpoint?: string;
  reachable?: boolean;
};

export type ProjectProfile = {
  name: string;
  summary: string;
  markets: string[];
  environments: string[];
  users?: { metric: string; current: number; expected: number; at_month: number };
};

export type ProjectUsers = { metric: string; current: number; expected: number; at_month: number };

export type Application = {
  id: string;
  name: string;
  summary: string;
  stacks: string[];
  users: ProjectUsers;
};

export type Project = {
  id: string;
  description: string;
  forbidden_providers: string[];
  profile?: ProjectProfile;
  applications?: Application[];
};

export type FocusMode = "plan" | "project";

export type AppAnswer = {
  id: string;
  users_now: number;
  users_expected: number;
  at_month: number;
  criteria: Criteria;
};

export type OnboardingSetup = {
  connections: Connection[];
  providers: string[];
  onprem: boolean;
  projects: Project[];
  markets?: string[];
};

export type Focus = "availability" | "zone" | "performance" | "cost";

export type Criteria = {
  focus: Focus;
  market?: string;
};

export type ProfileSite = {
  kind: "headquarters" | "search";
  label: string;
  lat: number;
  lng: number;
  radius_km?: number;
  free_area_m2?: number;
};

export type Profile = {
  criteria: Criteria;
  projects?: Record<string, Criteria>;
  onprem: { wanted: boolean; site?: ProfileSite };
};

export type Answers = {
  connection: string;
  project: string;
  targets: string[];
  onprem: boolean;
  site?: ProfileSite;
  criteria: Criteria;
  focusMode: FocusMode;
  apps: AppAnswer[];
};

export type StartRequest = {
  project: string;
  onboarding: {
    connection: string;
    targets: string[];
    onprem: { wanted: boolean };
    criteria: Criteria;
    focus_mode?: FocusMode;
    applications?: AppAnswer[];
  };
};

export type StartedRun = {
  id: string;
  project: string;
};

export type Choice = {
  id: string;
  label: string;
  ticked: boolean;
  disabled: boolean;
  hint?: string;
};
