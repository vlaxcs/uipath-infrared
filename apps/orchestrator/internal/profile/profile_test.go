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

func area(lat, lng, radius float64) profile.Area {
	return profile.Area{Lat: lat, Lng: lng, RadiusKm: radius}
}

func search(areas ...profile.Area) *profile.Site { return &profile.Site{Kind: "search", Areas: areas} }

func headquarters(freeArea *float64) *profile.Site {
	return &profile.Site{Kind: "headquarters", Label: "HQ", Lat: number(44), Lng: number(26), FreeAreaM2: freeArea}
}

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
	saved.Onprem = profile.Onprem{Wanted: true, Site: search(area(44.43, 26.1, 25), area(46.77, 23.6, 40), area(45.75, 21.23, 10))}
	if err := store.SaveProfile(saved); err != nil {
		t.Fatal(err)
	}
	got, err := profile.Open(dir).Profile()
	if err != nil {
		t.Fatal(err)
	}
	if got.Criteria.Market != "fr" || got.Onprem.Site == nil || len(got.Onprem.Site.Areas) != 3 || got.Onprem.Site.Areas[1].RadiusKm != 40 {
		t.Fatalf("read back %+v", got)
	}
}

func TestABadProfileIsRefusedAndNothingIsWritten(t *testing.T) {
	cases := map[string]func(*profile.Profile){
		"bad criteria":                  func(p *profile.Profile) { p.Criteria.Focus = "speed" },
		"on-prem wanted without a site": func(p *profile.Profile) { p.Onprem.Wanted = true },
		"a headquarters without area":   func(p *profile.Profile) { p.Onprem.Site = headquarters(nil) },
		"a headquarters with areas": func(p *profile.Profile) {
			p.Onprem.Site = headquarters(number(120))
			p.Onprem.Site.Areas = []profile.Area{area(44, 26, 25)}
		},
		"a search without an area": func(p *profile.Profile) { p.Onprem.Site = search() },
		"a search of four areas": func(p *profile.Profile) {
			p.Onprem.Site = search(area(44, 26, 25), area(45, 26, 25), area(46, 26, 25), area(47, 26, 25))
		},
		"an area of 200 km":     func(p *profile.Profile) { p.Onprem.Site = search(area(44, 26, 200)) },
		"an area of 4 km":       func(p *profile.Profile) { p.Onprem.Site = search(area(44, 26, 25), area(45, 26, 4)) },
		"an area off the Earth": func(p *profile.Profile) { p.Onprem.Site = search(area(95, 26, 25)) },
		"a headquarters off the Earth": func(p *profile.Profile) {
			p.Onprem.Site = headquarters(number(120))
			p.Onprem.Site.Lng = number(190)
		},
		"a search with a free area": func(p *profile.Profile) {
			p.Onprem.Site = search(area(44, 26, 25))
			p.Onprem.Site.FreeAreaM2 = number(120)
		},
		"a search with its own point": func(p *profile.Profile) {
			p.Onprem.Site = search(area(44, 26, 25))
			p.Onprem.Site.Lat, p.Onprem.Site.Lng = number(44), number(26)
		},
		"an unknown site kind": func(p *profile.Profile) {
			p.Onprem.Site = &profile.Site{Kind: "garage", Label: "x", Lat: number(44), Lng: number(26)}
		},
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

func TestASearchSavedAsOnePinAndARadiusIsReadAsOneArea(t *testing.T) {
	dir := t.TempDir()
	old := `{"criteria":{"focus":"cost"},"onprem":{"wanted":true,"site":{"kind":"search","label":"Bucharest","lat":44.43,"lng":26.1,"radius_km":25}}}`
	if err := os.WriteFile(filepath.Join(dir, "profile.json"), []byte(old), 0o644); err != nil {
		t.Fatal(err)
	}
	got, err := profile.Open(dir).Profile()
	if err != nil {
		t.Fatal(err)
	}
	want := profile.Area{Label: "Bucharest", Lat: 44.43, Lng: 26.1, RadiusKm: 25}
	site := got.Onprem.Site
	if !got.Onprem.Wanted || site == nil || len(site.Areas) != 1 || site.Areas[0] != want || site.Lat != nil || site.Label != "" {
		t.Fatalf("read %+v", site)
	}
}
