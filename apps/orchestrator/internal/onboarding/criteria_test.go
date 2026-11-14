package onboarding_test

import (
	"encoding/json"
	"errors"
	"testing"

	"infrared/orchestrator/internal/onboarding"
)

func forecastDocument(t *testing.T) map[string]any {
	t.Helper()
	var document map[string]any
	raw := `{
		"hard_constraints": {"min_availability_pct": 99.4, "data_residency": {"allowed_regions": ["eu-*"], "applies_to": ["pii"]}},
		"cto_settings": {"ha_level": "multi_az", "min_zones": 2, "weights": {"cost": 0.65, "risk": 0.25, "effort": 0.1}}
	}`
	if err := json.Unmarshal([]byte(raw), &document); err != nil {
		t.Fatal(err)
	}
	return document
}

func applied(t *testing.T, criteria onboarding.Criteria) (map[string]any, map[string]any) {
	t.Helper()
	asked := answers("aws")
	asked.Criteria = &criteria
	constraints, err := onboarding.Resolve(asked, catalog, nil)
	if err != nil {
		t.Fatal(err)
	}
	document := forecastDocument(t)
	if err := onboarding.Apply(document, constraints); err != nil {
		t.Fatal(err)
	}
	return document["hard_constraints"].(map[string]any), document["cto_settings"].(map[string]any)
}

func TestHighAvailabilityRaisesTheTargetAndRanksByRisk(t *testing.T) {
	hard, settings := applied(t, onboarding.Criteria{Focus: onboarding.FocusAvailability})
	if hard["min_availability_pct"] != 99.95 || settings["min_zones"] != 2.0 {
		t.Fatalf("availability %v, zones %v", hard["min_availability_pct"], settings["min_zones"])
	}
	if weights := settings["weights"].(map[string]any); weights["risk"] != 0.65 {
		t.Fatalf("weights %v", weights)
	}
}

func TestHighAvailabilityNeverLowersAStricterProject(t *testing.T) {
	asked := answers("aws")
	asked.Criteria = &onboarding.Criteria{Focus: onboarding.FocusAvailability}
	constraints, _ := onboarding.Resolve(asked, catalog, nil)
	document := forecastDocument(t)
	document["hard_constraints"].(map[string]any)["min_availability_pct"] = 99.99
	document["cto_settings"].(map[string]any)["min_zones"] = 3.0
	if err := onboarding.Apply(document, constraints); err != nil {
		t.Fatal(err)
	}
	if document["hard_constraints"].(map[string]any)["min_availability_pct"] != 99.99 || document["cto_settings"].(map[string]any)["min_zones"] != 3.0 {
		t.Fatal("the project's stricter targets were lowered")
	}
}

func TestAZoneNarrowsTheRegionsToTheMarket(t *testing.T) {
	cases := map[string]string{"fr": `["eu-*"]`, "us": `["us-*"]`}
	for market, want := range cases {
		hard, _ := applied(t, onboarding.Criteria{Focus: onboarding.FocusZone, Market: market})
		residency := hard["data_residency"].(map[string]any)
		if regions, _ := json.Marshal(residency["allowed_regions"]); string(regions) != want {
			t.Errorf("%s: regions %s, want %s", market, regions, want)
		}
		if applies, _ := json.Marshal(residency["applies_to"]); string(applies) != `["pii"]` {
			t.Errorf("%s: the data the residency rule covers changed: %s", market, applies)
		}
		if hard["min_availability_pct"] != 99.4 {
			t.Errorf("%s: a zone focus changed the availability target", market)
		}
	}
}

func TestCostReductionOnlyReranks(t *testing.T) {
	hard, settings := applied(t, onboarding.Criteria{Focus: onboarding.FocusCost})
	if weights := settings["weights"].(map[string]any); weights["cost"] != 0.65 || weights["risk"] != 0.25 {
		t.Fatalf("weights %v", weights)
	}
	if hard["min_availability_pct"] != 99.4 || settings["min_zones"] != 2.0 {
		t.Fatal("cost reduction changed a hard constraint")
	}
}

func TestWithoutCriteriaTheProjectsForecastStays(t *testing.T) {
	constraints, err := onboarding.Resolve(answers("aws"), catalog, nil)
	if err != nil {
		t.Fatal(err)
	}
	document := forecastDocument(t)
	if err := onboarding.Apply(document, constraints); err != nil {
		t.Fatal(err)
	}
	if document["hard_constraints"].(map[string]any)["min_availability_pct"] != 99.4 {
		t.Fatal("the project's availability target was replaced without criteria")
	}
}

func TestBadCriteriaAreRefusedWithTheReason(t *testing.T) {
	cases := map[string]onboarding.Criteria{
		"no focus":              {},
		"an unknown focus":      {Focus: "speed"},
		"a zone without market": {Focus: onboarding.FocusZone},
		"an unknown market":     {Focus: onboarding.FocusZone, Market: "atlantis"},
		"a market without zone": {Focus: onboarding.FocusCost, Market: "fr"},
	}
	for name, criteria := range cases {
		asked := answers("aws")
		asked.Criteria = &criteria
		if _, err := onboarding.Resolve(asked, catalog, nil); !errors.Is(err, onboarding.ErrInvalid) {
			t.Errorf("%s: %v, want invalid", name, err)
		}
	}
}
