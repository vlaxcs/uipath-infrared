package onboarding_test

import (
	"encoding/json"
	"errors"
	"slices"
	"strings"
	"testing"

	"infrared/orchestrator/internal/onboarding"
)

var catalog = onboarding.Catalog{Providers: []string{"aws", "gcp", "managed_pg"}, Onprem: true}

func answers(targets ...string) onboarding.Answers {
	return onboarding.Answers{Connection: onboarding.Floci, Targets: targets}
}

func TestTheTargetsReplaceTheAllowedProviders(t *testing.T) {
	got, err := onboarding.Resolve(answers("managed_pg", "aws"), catalog, nil)
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(got.Allowed, []string{"aws", "managed_pg"}) {
		t.Fatalf("allowed %v", got.Allowed)
	}
}

func TestUntickedProvidersAndAnUnwantedOnpremAreForbidden(t *testing.T) {
	got, err := onboarding.Resolve(answers("aws"), catalog, nil)
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(got.Forbidden, []string{"gcp", "managed_pg", "onprem"}) {
		t.Fatalf("forbidden %v", got.Forbidden)
	}
}

func TestAWantedOnpremIsAllowed(t *testing.T) {
	wanted := answers("aws", "gcp", "managed_pg")
	wanted.Onprem.Wanted = true
	got, err := onboarding.Resolve(wanted, catalog, nil)
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(got.Allowed, []string{"aws", "gcp", "managed_pg", "onprem"}) || len(got.Forbidden) != 0 {
		t.Fatalf("allowed %v, forbidden %v", got.Allowed, got.Forbidden)
	}
}

func TestTheProjectsForbiddenProvidersStayForbidden(t *testing.T) {
	got, err := onboarding.Resolve(answers("aws", "managed_pg"), catalog, []string{"gcp", "azure"})
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(got.Forbidden, []string{"azure", "gcp", "onprem"}) {
		t.Fatalf("forbidden %v", got.Forbidden)
	}
}

func TestBadAnswersAreRefusedWithTheReason(t *testing.T) {
	wantedOnprem := func(a onboarding.Answers) onboarding.Answers { a.Onprem.Wanted = true; return a }
	cases := []struct {
		name      string
		answers   onboarding.Answers
		catalog   onboarding.Catalog
		forbidden []string
		reason    string
	}{
		{"another connection", onboarding.Answers{Connection: "aws-account", Targets: []string{"aws"}}, catalog, nil, "connection"},
		{"no target", answers(), catalog, nil, "at least one"},
		{"a target twice", answers("aws", "aws"), catalog, nil, "twice"},
		{"a target the catalog does not price", answers("azure"), catalog, nil, "does not price"},
		{"onprem as a target", answers("onprem"), catalog, nil, "does not price"},
		{"a target the project forbids", answers("gcp"), catalog, []string{"gcp"}, "forbidden by the project"},
		{"onprem the project forbids", wantedOnprem(answers("aws")), catalog, []string{"onprem"}, "forbidden by the project"},
		{"onprem with no on-prem option", wantedOnprem(answers("aws")), onboarding.Catalog{Providers: []string{"aws"}}, nil, "no on-prem option"},
	}
	for _, c := range cases {
		_, err := onboarding.Resolve(c.answers, c.catalog, c.forbidden)
		if !errors.Is(err, onboarding.ErrInvalid) || !strings.Contains(err.Error(), c.reason) {
			t.Errorf("%s: %v, want ErrInvalid mentioning %q", c.name, err, c.reason)
		}
	}
}

func TestApplyWritesBothListsAndKeepsTheRestOfTheForecast(t *testing.T) {
	var forecast map[string]any
	decoder := json.NewDecoder(strings.NewReader(`{"id": "startup", "hard_constraints": {"allowed_providers": ["aws"], "min_availability_pct": 99.4}}`))
	decoder.UseNumber()
	if err := decoder.Decode(&forecast); err != nil {
		t.Fatal(err)
	}
	err := onboarding.Apply(forecast, onboarding.Constraints{Allowed: []string{"aws", "onprem"}, Forbidden: []string{"gcp"}})
	if err != nil {
		t.Fatal(err)
	}
	written, _ := json.Marshal(forecast)
	want := `{"hard_constraints":{"allowed_providers":["aws","onprem"],"forbidden_providers":["gcp"],"min_availability_pct":99.4},"id":"startup"}`
	if string(written) != want {
		t.Fatalf("got  %s\nwant %s", written, want)
	}
}

func TestApplyRefusesAForecastWithoutHardConstraints(t *testing.T) {
	if err := onboarding.Apply(map[string]any{"id": "startup"}, onboarding.Constraints{}); err == nil {
		t.Fatal("applied to a forecast with no hard_constraints")
	}
}

func TestForbiddenInReadsTheProjectsList(t *testing.T) {
	forecast := map[string]any{"hard_constraints": map[string]any{"forbidden_providers": []any{"gcp", "azure"}}}
	if got := onboarding.ForbiddenIn(forecast); !slices.Equal(got, []string{"gcp", "azure"}) {
		t.Fatalf("got %v", got)
	}
	if got := onboarding.ForbiddenIn(map[string]any{}); len(got) != 0 {
		t.Fatalf("got %v from a forecast with no list", got)
	}
}

func TestEachApplicationScalesOnTheUsersAndFocusTheAnalysisGave(t *testing.T) {
	asked := answers("aws")
	asked.FocusMode = onboarding.FocusPerProject
	asked.Apps = []onboarding.AppAnswer{{ID: "booking", UsersNow: 50000, UsersExpected: 150000, AtMonth: 36, Criteria: &onboarding.Criteria{Focus: onboarding.FocusAvailability}}}
	constraints, err := onboarding.Resolve(asked, catalog, nil)
	if err != nil {
		t.Fatal(err)
	}
	forecast := map[string]any{
		"hard_constraints": map[string]any{},
		"projects": []any{map[string]any{"id": "booking", "users": map[string]any{"metric": "monthly_active_users", "current": 41000.0,
			"expected": []any{map[string]any{"month": 24.0, "low": 70300.0, "base": 112500.0, "high": 178500.0}}}}},
	}
	if err := onboarding.Apply(forecast, constraints); err != nil {
		t.Fatal(err)
	}
	project := forecast["projects"].([]any)[0].(map[string]any)
	users := project["users"].(map[string]any)
	row := users["expected"].([]any)[0].(map[string]any)
	if users["current"] != 50000 || row["month"] != 36 || row["base"] != 150000 || row["low"] != 93733 || row["high"] != 238000 {
		t.Fatalf("users %v", users)
	}
	if focus := project["focus"].(map[string]any); focus["focus"] != "availability" {
		t.Fatalf("focus %v", project["focus"])
	}
}

func TestAnApplicationTheEstateDoesNotHaveIsRefused(t *testing.T) {
	asked := answers("aws")
	asked.Apps = []onboarding.AppAnswer{{ID: "ghost", UsersNow: 1, UsersExpected: 2, AtMonth: 12}}
	constraints, err := onboarding.Resolve(asked, catalog, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := onboarding.Apply(map[string]any{"hard_constraints": map[string]any{}, "projects": []any{}}, constraints); !errors.Is(err, onboarding.ErrInvalid) {
		t.Fatalf("got %v", err)
	}
}

func TestApplicationAnswersAreCheckedBeforeTheRunStarts(t *testing.T) {
	for name, app := range map[string]onboarding.AppAnswer{
		"no users now": {ID: "a", UsersNow: 0, UsersExpected: 10, AtMonth: 12},
		"no month":     {ID: "a", UsersNow: 1, UsersExpected: 10, AtMonth: 0},
		"a bad focus":  {ID: "a", UsersNow: 1, UsersExpected: 10, AtMonth: 12, Criteria: &onboarding.Criteria{Focus: "speed"}},
	} {
		asked := answers("aws")
		asked.Apps = []onboarding.AppAnswer{app}
		if _, err := onboarding.Resolve(asked, catalog, nil); !errors.Is(err, onboarding.ErrInvalid) {
			t.Errorf("%s: %v", name, err)
		}
	}
}

func TestTheScenarioSpreadSurvivesAForecastDecodedWithNumbers(t *testing.T) {
	asked := answers("aws")
	asked.Apps = []onboarding.AppAnswer{{ID: "booking", UsersNow: 50000, UsersExpected: 150000, AtMonth: 36}}
	constraints, err := onboarding.Resolve(asked, catalog, nil)
	if err != nil {
		t.Fatal(err)
	}
	var forecast map[string]any
	decoder := json.NewDecoder(strings.NewReader(`{"hard_constraints": {}, "projects": [{"id": "booking", "users": {"metric": "m", "current": 41000,
		"expected": [{"month": 24, "low": 70300, "base": 112500, "high": 178500}]}}]}`))
	decoder.UseNumber()
	if err := decoder.Decode(&forecast); err != nil {
		t.Fatal(err)
	}
	if err := onboarding.Apply(forecast, constraints); err != nil {
		t.Fatal(err)
	}
	row := forecast["projects"].([]any)[0].(map[string]any)["users"].(map[string]any)["expected"].([]any)[0].(map[string]any)
	if row["low"] != 93733 || row["high"] != 238000 {
		t.Fatalf("the spread was lost: %v", row)
	}
}
