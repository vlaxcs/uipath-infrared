package run

import "errors"

const SchemaVersion = "1.0"

var ErrArtifactTooLarge = errors.New("artifact is over the size limit")

type Step string

const (
	Extract     Step = "extract"
	Investigate Step = "investigate"
	Propose     Step = "propose"
	Evaluate    Step = "evaluate"
	Present     Step = "present"
	Rehearse    Step = "rehearse"
)

type Status string

const (
	Running          Status = "running"
	AwaitingApproval Status = "awaiting_approval"
	Completed        Status = "completed"
	Failed           Status = "failed"
)

type EventStatus string

const (
	Started       EventStatus = "started"
	StepCompleted EventStatus = "completed"
	StepFailed    EventStatus = "failed"
	OpensGate     EventStatus = "awaiting_approval"
	Approved      EventStatus = "approved"
)

type Gate string

const (
	LayoutGate Gate = "layout"
	PlanGate   Gate = "plan"
)

type DecisionKind string

const (
	Proceed      DecisionKind = "proceed"
	Revise       DecisionKind = "revise"
	Stop         DecisionKind = "stop"
	KeepAnalyses DecisionKind = "keep_analyses"
	PickLayout   DecisionKind = "pick_layout"
	ApprovePlan  DecisionKind = "approve_plan"
)

type File struct {
	Path   string `json:"path"`
	Sha256 string `json:"sha256"`
}

type Artifact struct {
	Path string `json:"path"`
	Size int64  `json:"size"`
}

type Inputs struct {
	Forecast File `json:"forecast"`
	Catalog  File `json:"catalog"`
}

type Actor struct {
	Kind    string `json:"kind"`
	ID      string `json:"id,omitempty"`
	Surface string `json:"surface,omitempty"`
}

var OrchestratorActor = Actor{Kind: "orchestrator"}

type Decision struct {
	Kind     DecisionKind `json:"kind"`
	Reason   string       `json:"reason"`
	Analyses []string     `json:"analyses,omitempty"`
	Layout   string       `json:"layout,omitempty"`
}

type Output struct {
	Contract string `json:"contract"`
	File     File   `json:"file"`
}

type LayoutOption struct {
	ID              string   `json:"id"`
	Feasible        bool     `json:"feasible"`
	Rank            *int     `json:"rank,omitempty"`
	MonthlyEUR      *float64 `json:"monthly_eur,omitempty"`
	AvailabilityPct *float64 `json:"availability_pct,omitempty"`
	Risk            *float64 `json:"risk,omitempty"`
}

type Event struct {
	Seq         int            `json:"seq"`
	At          string         `json:"at"`
	Step        Step           `json:"step"`
	Status      EventStatus    `json:"status"`
	Revision    int            `json:"revision"`
	Actor       Actor          `json:"actor"`
	Gate        Gate           `json:"gate,omitempty"`
	Decision    *Decision      `json:"decision,omitempty"`
	Output      *Output        `json:"output,omitempty"`
	XCandidates []LayoutOption `json:"x_candidates,omitempty"`
}

type Summary struct {
	SchemaVersion string `json:"schema_version"`
	ID            string `json:"id"`
	Project       string `json:"project"`
	Status        Status `json:"status"`
	Step          Step   `json:"step"`
	Revision      int    `json:"revision"`
	MaxRevisions  int    `json:"max_revisions"`
	StartedAt     string `json:"started_at"`
	UpdatedAt     string `json:"updated_at"`
	FinishedAt    string `json:"finished_at,omitempty"`
	Awaiting      Gate   `json:"awaiting,omitempty"`
}

type Run struct {
	Summary
	Inputs Inputs  `json:"inputs"`
	Events []Event `json:"events"`
}
