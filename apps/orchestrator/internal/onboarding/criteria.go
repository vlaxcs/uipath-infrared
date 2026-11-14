package onboarding

import (
	"errors"
	"regexp"
)

const (
	MinAvailabilityPct = 90.0
	MaxZones           = 3
)

var regionPattern = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9*]+)*$|^[a-z0-9]+-\*$`)

type Weights struct {
	Cost   float64 `json:"cost"`
	Risk   float64 `json:"risk"`
	Effort float64 `json:"effort"`
}

type Criteria struct {
	MinAvailabilityPct float64  `json:"min_availability_pct"`
	MinZones           int      `json:"min_zones"`
	Weights            Weights  `json:"weights"`
	AllowedRegions     []string `json:"allowed_regions"`
}

func CheckCriteria(criteria Criteria) error {
	if criteria.MinAvailabilityPct < MinAvailabilityPct || criteria.MinAvailabilityPct >= 100 {
		return invalid("min_availability_pct must be at least %g and below 100", MinAvailabilityPct)
	}
	if criteria.MinZones < 1 || criteria.MinZones > MaxZones {
		return invalid("min_zones must be from 1 to %d", MaxZones)
	}
	weights := criteria.Weights
	if weights.Cost < 0 || weights.Risk < 0 || weights.Effort < 0 || weights.Cost+weights.Risk+weights.Effort == 0 {
		return invalid("weights must be non-negative and not all zero")
	}
	if len(criteria.AllowedRegions) == 0 {
		return invalid("allow at least one region")
	}
	seen := make(map[string]bool, len(criteria.AllowedRegions))
	for _, region := range criteria.AllowedRegions {
		if !regionPattern.MatchString(region) {
			return invalid("region %q is not a region or a region pattern such as eu-*", region)
		}
		if seen[region] {
			return invalid("region %s is listed twice", region)
		}
		seen[region] = true
	}
	return nil
}

func applyCriteria(forecast map[string]any, criteria Criteria) error {
	hard, _ := forecast["hard_constraints"].(map[string]any)
	settings, ok := forecast["cto_settings"].(map[string]any)
	if hard == nil || !ok {
		return errors.New("the forecast has no hard_constraints or cto_settings object")
	}
	hard["min_availability_pct"] = criteria.MinAvailabilityPct
	settings["min_zones"] = criteria.MinZones
	settings["weights"] = map[string]any{"cost": criteria.Weights.Cost, "risk": criteria.Weights.Risk, "effort": criteria.Weights.Effort}
	residency, _ := hard["data_residency"].(map[string]any)
	if residency == nil {
		residency = map[string]any{"applies_to": []any{"pii", "confidential", "unknown"}}
		hard["data_residency"] = residency
	}
	residency["allowed_regions"] = criteria.AllowedRegions
	return nil
}
