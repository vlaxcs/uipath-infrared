export type Connection = {
  id: string;
  label: string;
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
};

export type Weights = {
  cost: number;
  risk: number;
  effort: number;
};

export type Criteria = {
  min_availability_pct: number;
  min_zones: number;
  weights: Weights;
  allowed_regions: string[];
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
