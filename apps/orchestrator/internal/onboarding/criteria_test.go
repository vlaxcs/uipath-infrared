package onboarding_test

import (
	"encoding/json"
	"errors"
	"testing"

	"infrared/orchestrator/internal/onboarding"
)

func criteria() *onboarding.Criteria {
	return &onboarding.Criteria{
		MinAvailabilityPct: 99.95,
		MinZones:           3,
		Weights:            onboarding.Weights{Cost: 0.2, Risk: 0.7, Effort: 0.1},
		AllowedRegions:     []string{"eu-*", "us-east-1"},
	}
}

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

func TestCriteriaReachTheForecastTheEngineReads(t *testing.T) {
	asked := answers("aws")
	asked.Criteria = criteria()
	constraints, err := onboarding.Resolve(asked, catalog, nil)
	if err != nil {
		t.Fatal(err)
	}
	document := forecastDocument(t)
	if err := onboarding.Apply(document, constraints); err != nil {
		t.Fatal(err)
	}
	hard := document["hard_constraints"].(map[string]any)
	settings := document["cto_settings"].(map[string]any)
	residency := hard["data_residency"].(map[string]any)
	if hard["min_availability_pct"] != 99.95 || settings["min_zones"] != 3 {
		t.Fatalf("availability %v, zones %v", hard["min_availability_pct"], settings["min_zones"])
	}
	weights := settings["weights"].(map[string]any)
	if weights["cost"] != 0.2 || weights["risk"] != 0.7 || weights["effort"] != 0.1 {
		t.Fatalf("weights %v", weights)
	}
	regions, _ := json.Marshal(residency["allowed_regions"])
	if string(regions) != `["eu-*","us-east-1"]` {
		t.Fatalf("regions %s", regions)
	}
	if applies, _ := json.Marshal(residency["applies_to"]); string(applies) != `["pii"]` {
		t.Fatalf("the data the residency rule covers changed: %s", applies)
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
	cases := map[string]func(*onboarding.Criteria){
		"availability below 90":  func(c *onboarding.Criteria) { c.MinAvailabilityPct = 80 },
		"availability of 100":    func(c *onboarding.Criteria) { c.MinAvailabilityPct = 100 },
		"no zone":                func(c *onboarding.Criteria) { c.MinZones = 0 },
		"four zones":             func(c *onboarding.Criteria) { c.MinZones = 4 },
		"a negative weight":      func(c *onboarding.Criteria) { c.Weights.Cost = -1 },
		"every weight zero":      func(c *onboarding.Criteria) { c.Weights = onboarding.Weights{} },
		"no region":              func(c *onboarding.Criteria) { c.AllowedRegions = nil },
		"a region with a slash":  func(c *onboarding.Criteria) { c.AllowedRegions = []string{"eu/west"} },
		"the same region twice":  func(c *onboarding.Criteria) { c.AllowedRegions = []string{"eu-*", "eu-*"} },
	}
	for name, breakIt := range cases {
		asked := answers("aws")
		asked.Criteria = criteria()
		breakIt(asked.Criteria)
		if _, err := onboarding.Resolve(asked, catalog, nil); !errors.Is(err, onboarding.ErrInvalid) {
			t.Errorf("%s: %v, want invalid", name, err)
		}
	}
}
