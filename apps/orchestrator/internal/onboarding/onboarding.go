package onboarding

import (
	"encoding/json"
	"errors"
	"fmt"
	"slices"
)

const (
	Floci          = "floci"
	OnpremProvider = "onprem"
)

var ErrInvalid = errors.New("invalid onboarding")

type Answers struct {
	Connection string      `json:"connection"`
	Targets    []string    `json:"targets"`
	Onprem     Onprem      `json:"onprem"`
	Criteria   *Criteria   `json:"criteria,omitempty"`
	FocusMode  string      `json:"focus_mode,omitempty"`
	Apps       []AppAnswer `json:"applications,omitempty"`
}

const (
	FocusPerPlan    = "plan"
	FocusPerProject = "project"
)

type AppAnswer struct {
	ID            string    `json:"id"`
	UsersNow      int       `json:"users_now"`
	UsersExpected int       `json:"users_expected"`
	AtMonth       int       `json:"at_month"`
	Criteria      *Criteria `json:"criteria,omitempty"`
}

type Application struct {
	ID      string       `json:"id"`
	Name    string       `json:"name"`
	Summary string       `json:"summary"`
	Stacks  []string     `json:"stacks"`
	Users   ProjectUsers `json:"users"`
}

type Onprem struct {
	Wanted bool `json:"wanted"`
}

type Catalog struct {
	Providers []string
	Onprem    bool
}

type Constraints struct {
	Allowed   []string
	Forbidden []string
	Criteria  *Criteria
	FocusMode string
	Apps      []AppAnswer
}

type Connection struct {
	ID        string `json:"id"`
	Label     string `json:"label"`
	Endpoint  string `json:"endpoint,omitempty"`
	Reachable *bool  `json:"reachable,omitempty"`
}

type Project struct {
	ID                 string          `json:"id"`
	Description        string          `json:"description"`
	ForbiddenProviders []string        `json:"forbidden_providers"`
	Profile            *ProjectProfile `json:"profile,omitempty"`
	Applications       []Application   `json:"applications,omitempty"`
}

type ProjectProfile struct {
	Name         string        `json:"name"`
	Summary      string        `json:"summary"`
	Markets      []string      `json:"markets"`
	Environments []string      `json:"environments"`
	Users        *ProjectUsers `json:"users,omitempty"`
}

type ProjectUsers struct {
	Metric   string `json:"metric"`
	Current  int    `json:"current"`
	Expected int    `json:"expected"`
	AtMonth  int    `json:"at_month"`
}

type Setup struct {
	Connections []Connection `json:"connections"`
	Providers   []string     `json:"providers"`
	Onprem      bool         `json:"onprem"`
	Projects    []Project    `json:"projects"`
	Markets     []string     `json:"markets"`
}

var Connections = []Connection{{ID: Floci, Label: "AWS (demo estate)"}}

func Resolve(answers Answers, catalog Catalog, projectForbidden []string) (Constraints, error) {
	if answers.Connection != Floci {
		return Constraints{}, invalid("connection %q is not offered; the MVP connects to %s", answers.Connection, Floci)
	}
	if len(answers.Targets) == 0 {
		return Constraints{}, invalid("tick at least one target")
	}
	ticked := make(map[string]bool, len(answers.Targets))
	for _, target := range answers.Targets {
		if ticked[target] {
			return Constraints{}, invalid("%s is listed twice", target)
		}
		ticked[target] = true
		if !slices.Contains(catalog.Providers, target) {
			return Constraints{}, invalid("the catalog does not price %s", target)
		}
		if slices.Contains(projectForbidden, target) {
			return Constraints{}, invalid("%s is forbidden by the project", target)
		}
	}
	if answers.Criteria != nil {
		if err := CheckCriteria(*answers.Criteria); err != nil {
			return Constraints{}, err
		}
	}
	if answers.Onprem.Wanted {
		if !catalog.Onprem {
			return Constraints{}, invalid("on-prem is wanted, but the catalog has no on-prem option")
		}
		if slices.Contains(projectForbidden, OnpremProvider) {
			return Constraints{}, invalid("%s is forbidden by the project", OnpremProvider)
		}
	}
	allowed := slices.Clone(answers.Targets)
	forbidden := slices.Clone(projectForbidden)
	for _, provider := range catalog.Providers {
		if !ticked[provider] {
			forbidden = append(forbidden, provider)
		}
	}
	if answers.Onprem.Wanted {
		allowed = append(allowed, OnpremProvider)
	} else {
		forbidden = append(forbidden, OnpremProvider)
	}
	if answers.FocusMode != "" && answers.FocusMode != FocusPerPlan && answers.FocusMode != FocusPerProject {
		return Constraints{}, invalid("focus_mode must be plan or project")
	}
	seen := make(map[string]bool, len(answers.Apps))
	for _, app := range answers.Apps {
		if seen[app.ID] {
			return Constraints{}, invalid("application %s is listed twice", app.ID)
		}
		seen[app.ID] = true
		if app.UsersNow <= 0 || app.UsersExpected <= 0 || app.AtMonth < 1 {
			return Constraints{}, invalid("%s: users now and expected must be above 0, and the month at least 1", app.ID)
		}
		if app.Criteria != nil {
			if err := CheckCriteria(*app.Criteria); err != nil {
				return Constraints{}, err
			}
		}
	}
	return Constraints{Allowed: sortedUnique(allowed), Forbidden: sortedUnique(forbidden), Criteria: answers.Criteria, FocusMode: answers.FocusMode, Apps: answers.Apps}, nil
}

func Apply(forecast map[string]any, constraints Constraints) error {
	hard, ok := forecast["hard_constraints"].(map[string]any)
	if !ok {
		return errors.New("the forecast has no hard_constraints object")
	}
	hard["allowed_providers"] = constraints.Allowed
	hard["forbidden_providers"] = constraints.Forbidden
	if constraints.Criteria != nil {
		if err := applyCriteria(forecast, *constraints.Criteria); err != nil {
			return err
		}
	}
	return applyApps(forecast, constraints)
}

func applyApps(forecast map[string]any, constraints Constraints) error {
	if len(constraints.Apps) == 0 {
		return nil
	}
	listed, _ := forecast["projects"].([]any)
	byID := make(map[string]map[string]any, len(listed))
	for _, item := range listed {
		if project, ok := item.(map[string]any); ok {
			if id, _ := project["id"].(string); id != "" {
				byID[id] = project
			}
		}
	}
	for _, app := range constraints.Apps {
		project, ok := byID[app.ID]
		if !ok {
			return invalid("%s is not an application of this estate", app.ID)
		}
		users, _ := project["users"].(map[string]any)
		if users == nil {
			users = map[string]any{"metric": "users"}
			project["users"] = users
		}
		low, high := spread(users)
		users["current"] = app.UsersNow
		users["expected"] = []any{map[string]any{
			"month": app.AtMonth,
			"low":   max(1, round(float64(app.UsersExpected)*low)),
			"base":  app.UsersExpected,
			"high":  max(1, round(float64(app.UsersExpected)*high)),
		}}
		if constraints.FocusMode == FocusPerProject && app.Criteria != nil {
			focus := map[string]any{"focus": string(app.Criteria.Focus)}
			if app.Criteria.Market != "" {
				focus["market"] = app.Criteria.Market
			}
			project["focus"] = focus
		} else {
			delete(project, "focus")
		}
	}
	return nil
}

func spread(users map[string]any) (float64, float64) {
	rows, _ := users["expected"].([]any)
	var last map[string]any
	lastMonth := -1.0
	for _, item := range rows {
		row, _ := item.(map[string]any)
		if month, ok := number(row["month"]); ok && month > lastMonth {
			last, lastMonth = row, month
		}
	}
	base, _ := number(last["base"])
	if base <= 0 {
		return 1, 1
	}
	low, okLow := number(last["low"])
	high, okHigh := number(last["high"])
	if !okLow {
		low = base
	}
	if !okHigh {
		high = base
	}
	return low / base, high / base
}

func number(value any) (float64, bool) {
	switch typed := value.(type) {
	case float64:
		return typed, true
	case int:
		return float64(typed), true
	case json.Number:
		parsed, err := typed.Float64()
		return parsed, err == nil
	}
	return 0, false
}

func round(value float64) int {
	return int(value + 0.5)
}

func ForbiddenIn(forecast map[string]any) []string {
	hard, _ := forecast["hard_constraints"].(map[string]any)
	listed, _ := hard["forbidden_providers"].([]any)
	providers := make([]string, 0, len(listed))
	for _, provider := range listed {
		if name, ok := provider.(string); ok {
			providers = append(providers, name)
		}
	}
	return providers
}

func sortedUnique(providers []string) []string {
	slices.Sort(providers)
	return slices.Compact(providers)
}

func invalid(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrInvalid, fmt.Sprintf(format, args...))
}
