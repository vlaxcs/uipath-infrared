package run

import (
	"fmt"
	"strings"
)

type CandidateOutcome struct {
	ID              string
	Source          string
	Feasible        bool
	Constraints     []string
	Rank            *int
	MonthlyEUR      *float64
	AvailabilityPct *float64
	Risk            *float64
}

type Result struct {
	Winner     string
	Candidates []CandidateOutcome
}

func (r *Run) EvaluateDecision(result Result) Decision {
	var broken []string
	anyFeasible := false
	for _, candidate := range result.Candidates {
		anyFeasible = anyFeasible || candidate.Feasible
		if candidate.Source == "agent" && !candidate.Feasible {
			broken = append(broken, fmt.Sprintf("%s breaks %s", candidate.ID, strings.Join(distinct(candidate.Constraints), ", ")))
		}
	}
	switch {
	case len(broken) > 0:
		return r.reviseOrStop(strings.Join(broken, "; "))
	case !anyFeasible:
		return r.reviseOrStop("no candidate is feasible")
	}
	return Decision{Kind: Proceed, Reason: "every candidate the agent proposed passes the hard constraints"}
}

func (r *Run) RehearsalDecision(held bool, reason string) Decision {
	if held {
		return Decision{Kind: Proceed, Reason: reason}
	}
	return r.reviseOrStop(reason)
}

func (r *Run) reviseOrStop(reason string) Decision {
	if r.Revision >= r.MaxRevisions {
		return Decision{Kind: Stop, Reason: fmt.Sprintf("needs revision %d, max_revisions is %d; %s", r.Revision+1, r.MaxRevisions, reason)}
	}
	return Decision{Kind: Revise, Reason: reason}
}

func (result Result) FeasibleCandidate(id string) bool {
	for _, candidate := range result.Candidates {
		if candidate.ID == id {
			return candidate.Feasible
		}
	}
	return false
}

func (result Result) LayoutOptions() []LayoutOption {
	options := make([]LayoutOption, 0, len(result.Candidates))
	for _, candidate := range result.Candidates {
		option := LayoutOption{
			ID:              candidate.ID,
			Feasible:        candidate.Feasible,
			Rank:            candidate.Rank,
			MonthlyEUR:      candidate.MonthlyEUR,
			AvailabilityPct: candidate.AvailabilityPct,
			Risk:            candidate.Risk,
		}
		if !candidate.Feasible && len(candidate.Constraints) > 0 {
			option.LostBecause = &Lost{Reason: "constraint", Detail: strings.Join(distinct(candidate.Constraints), ", ")}
		}
		options = append(options, option)
	}
	return options
}

func distinct(values []string) []string {
	seen := make(map[string]bool, len(values))
	kept := make([]string, 0, len(values))
	for _, value := range values {
		if !seen[value] {
			seen[value] = true
			kept = append(kept, value)
		}
	}
	return kept
}
