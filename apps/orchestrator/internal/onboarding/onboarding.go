package onboarding

import (
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
	Connection string    `json:"connection"`
	Targets    []string  `json:"targets"`
	Onprem     Onprem    `json:"onprem"`
	Criteria   *Criteria `json:"criteria,omitempty"`
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
	return Constraints{Allowed: sortedUnique(allowed), Forbidden: sortedUnique(forbidden), Criteria: answers.Criteria}, nil
}

func Apply(forecast map[string]any, constraints Constraints) error {
	hard, ok := forecast["hard_constraints"].(map[string]any)
	if !ok {
		return errors.New("the forecast has no hard_constraints object")
	}
	hard["allowed_providers"] = constraints.Allowed
	hard["forbidden_providers"] = constraints.Forbidden
	if constraints.Criteria != nil {
		return applyCriteria(forecast, *constraints.Criteria)
	}
	return nil
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
