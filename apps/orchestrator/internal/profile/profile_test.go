package profile_test

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"infrared/orchestrator/internal/onboarding"
	"infrared/orchestrator/internal/profile"
)

func number(value float64) *float64 { return &value }

func TestAStoreWithoutAProfileGivesTheDefaults(t *testing.T) {
	got, err := profile.Open(t.TempDir()).Profile()
	if err != nil {
		t.Fatal(err)
	}
	if got.Criteria.Focus != onboarding.FocusCost || got.Onprem.Wanted {
		t.Fatalf("defaults %+v", got)
	}
}

func TestASavedProfileIsReadBack(t *testing.T) {
	dir := t.TempDir()
	store := profile.Open(dir)
	saved := profile.Default()
	saved.Criteria = onboarding.Criteria{Focus: onboarding.FocusZone, Market: "fr"}
	saved.Onprem = profile.Onprem{Wanted: true, Site: &profile.Site{Kind: "search", Label: "Bucharest", Lat: 44.43, Lng: 26.1, RadiusKm: number(25)}}
	if err := store.SaveProfile(saved); err != nil {
		t.Fatal(err)
	}
	got, err := profile.Open(dir).Profile()
	if err != nil {
		t.Fatal(err)
	}
	if got.Criteria.Market != "fr" || got.Onprem.Site == nil || *got.Onprem.Site.RadiusKm != 25 {
		t.Fatalf("read back %+v", got)
	}
}

func TestABadProfileIsRefusedAndNothingIsWritten(t *testing.T) {
	cases := map[string]func(*profile.Profile){
		"bad criteria":                  func(p *profile.Profile) { p.Criteria.Focus = "speed" },
		"on-prem wanted without a site": func(p *profile.Profile) { p.Onprem.Wanted = true },
		"a headquarters without area": func(p *profile.Profile) {
			p.Onprem.Site = &profile.Site{Kind: "headquarters", Label: "HQ", Lat: 44, Lng: 26}
		},
		"a headquarters with a radius": func(p *profile.Profile) {
			p.Onprem.Site = &profile.Site{Kind: "headquarters", Label: "HQ", Lat: 44, Lng: 26, FreeAreaM2: number(120), RadiusKm: number(25)}
		},
		"a search without a radius": func(p *profile.Profile) { p.Onprem.Site = &profile.Site{Kind: "search", Label: "x", Lat: 44, Lng: 26} },
		"a search of 200 km": func(p *profile.Profile) {
			p.Onprem.Site = &profile.Site{Kind: "search", Label: "x", Lat: 44, Lng: 26, RadiusKm: number(200)}
		},
		"a point off the Earth": func(p *profile.Profile) {
			p.Onprem.Site = &profile.Site{Kind: "search", Label: "x", Lat: 95, Lng: 26, RadiusKm: number(25)}
		},
		"an unknown site kind": func(p *profile.Profile) { p.Onprem.Site = &profile.Site{Kind: "garage", Label: "x", Lat: 44, Lng: 26} },
	}
	for name, breakIt := range cases {
		dir := t.TempDir()
		bad := profile.Default()
		breakIt(&bad)
		if err := profile.Open(dir).SaveProfile(bad); !errors.Is(err, profile.ErrInvalid) {
			t.Errorf("%s: %v, want invalid", name, err)
		}
		if _, err := os.Stat(filepath.Join(dir, "profile.json")); err == nil {
			t.Errorf("%s: a refused profile was written", name)
		}
	}
}

func TestAProfileFileThatDoesNotParseIsAnError(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "profile.json"), []byte("{"), 0o644)
	if _, err := profile.Open(dir).Profile(); err == nil {
		t.Fatal("a broken profile.json was read as the defaults")
	}
}

func TestAProfileSavedInTheOldShapeFallsBackToTheDefaults(t *testing.T) {
	dir := t.TempDir()
	old := `{"criteria":{"min_availability_pct":99.95,"min_zones":3,"weights":{"cost":0.2,"risk":0.7,"effort":0.1},"allowed_regions":["eu-*"]},"onprem":{"wanted":false}}`
	if err := os.WriteFile(filepath.Join(dir, "profile.json"), []byte(old), 0o644); err != nil {
		t.Fatal(err)
	}
	got, err := profile.Open(dir).Profile()
	if err != nil || got.Criteria.Focus != onboarding.FocusCost {
		t.Fatalf("%+v %v", got, err)
	}
}
