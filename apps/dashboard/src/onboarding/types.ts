export type Connection = {
  id: string;
  label: string;
  endpoint?: string;
  reachable?: boolean;
};

export type Project = {
  id: string;
  description: string;
  forbidden_providers: string[];
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
  onprem: { wanted: boolean; site?: ProfileSite };
};

export type Answers = {
  connection: string;
  project: string;
  targets: string[];
  onprem: boolean;
  criteria: Criteria;
};

export type StartRequest = {
  project: string;
  onboarding: {
    connection: string;
    targets: string[];
    onprem: { wanted: boolean };
    criteria: Criteria;
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
