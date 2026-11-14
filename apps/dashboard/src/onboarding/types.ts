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

export type Answers = {
  connection: string;
  project: string;
  targets: string[];
  onprem: boolean;
};

export type StartRequest = {
  project: string;
  onboarding: {
    connection: string;
    targets: string[];
    onprem: { wanted: boolean };
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
