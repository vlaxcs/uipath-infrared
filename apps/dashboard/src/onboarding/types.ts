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
  criteria?: Criteria;
  intent?: string;
};

export type OnboardingSetup = {
  connections: Connection[];
  providers: string[];
  onprem: boolean;
  projects: Project[];
  company?: string;
  markets?: string[];
};

export type Focus = "availability" | "zone" | "performance" | "cost";

export type Criteria = {
  focus: Focus;
  market?: string;
};

export type Point = { lat: number; lng: number };

export type SearchArea = Point & { label?: string; radius_km: number };

export type HeadquartersSite = Point & { kind: "headquarters"; label: string; free_area_m2: number };

export type SearchSite = { kind: "search"; areas: SearchArea[] };

export type ProfileSite = HeadquartersSite | SearchSite;

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
