package onboarding

import (
	"errors"
	"sort"
)

type Focus string

const (
	FocusAvailability Focus = "availability"
	FocusZone         Focus = "zone"
	FocusPerformance  Focus = "performance"
	FocusCost         Focus = "cost"
)

type Criteria struct {
	Focus  Focus  `json:"focus"`
	Market string `json:"market,omitempty"`
}

type weights struct{ cost, risk, effort float64 }

var focusWeights = map[Focus]weights{
	FocusAvailability: {cost: 0.2, risk: 0.65, effort: 0.15},
	FocusZone:         {cost: 0.4, risk: 0.4, effort: 0.2},
	FocusPerformance:  {cost: 0.4, risk: 0.4, effort: 0.2},
	FocusCost:         {cost: 0.65, risk: 0.25, effort: 0.1},
}

const (
	availabilityTargetPct = 99.95
	availabilityZones     = 2
	// A project's critical path multiplies its components' SLAs, so its target sits one step below the estate's.
	projectAvailabilityPct = 99.9
)

// The catalog prices regions as eu-* and us-*, so a market narrows to its group.
var marketRegions = map[string]string{
	"at": "eu-*", "be": "eu-*", "ch": "eu-*", "de": "eu-*", "dk": "eu-*", "es": "eu-*",
	"fi": "eu-*", "fr": "eu-*", "gb": "eu-*", "ie": "eu-*", "it": "eu-*", "nl": "eu-*",
	"no": "eu-*", "pl": "eu-*", "pt": "eu-*", "ro": "eu-*", "se": "eu-*",
	"us": "us-*",
}

func Markets() []string {
	codes := make([]string, 0, len(marketRegions))
	for code := range marketRegions {
		codes = append(codes, code)
	}
	sort.Strings(codes)
	return codes
}

func ProjectRules(criteria Criteria) map[string]any {
	rules := map[string]any{"focus": string(criteria.Focus)}
	switch criteria.Focus {
	case FocusAvailability:
		rules["min_availability_pct"] = projectAvailabilityPct
	case FocusZone:
		rules["market"] = criteria.Market
		rules["allowed_regions"] = []string{marketRegions[criteria.Market]}
	}
	return rules
}

func CheckCriteria(criteria Criteria) error {
	if _, known := focusWeights[criteria.Focus]; !known {
		return invalid("focus must be availability, zone, performance or cost")
	}
	if criteria.Focus == FocusZone {
		if _, known := marketRegions[criteria.Market]; !known {
			return invalid("zone needs a market the platform knows, such as fr")
		}
	} else if criteria.Market != "" {
		return invalid("market only goes with the zone focus")
	}
	return nil
}

func applyCriteria(forecast map[string]any, criteria Criteria) error {
	hard, _ := forecast["hard_constraints"].(map[string]any)
	settings, ok := forecast["cto_settings"].(map[string]any)
	if hard == nil || !ok {
		return errors.New("the forecast has no hard_constraints or cto_settings object")
	}
	chosen := focusWeights[criteria.Focus]
	settings["weights"] = map[string]any{"cost": chosen.cost, "risk": chosen.risk, "effort": chosen.effort}
	switch criteria.Focus {
	case FocusAvailability:
		if current, _ := hard["min_availability_pct"].(float64); current < availabilityTargetPct {
			hard["min_availability_pct"] = availabilityTargetPct
		}
		if current, _ := settings["min_zones"].(float64); current < availabilityZones {
			settings["min_zones"] = availabilityZones
		}
	case FocusZone:
		residency, _ := hard["data_residency"].(map[string]any)
		if residency == nil {
			residency = map[string]any{"applies_to": []any{"pii", "confidential", "unknown"}}
			hard["data_residency"] = residency
		}
		residency["allowed_regions"] = []string{marketRegions[criteria.Market]}
	}
	return nil
}
