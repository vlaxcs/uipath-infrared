package profile

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sync"

	"infrared/orchestrator/internal/adapters/files"
	"infrared/orchestrator/internal/onboarding"
)

const (
	fileName       = "profile.json"
	MaxSearchAreas = 3
	MinRadiusKm    = 5
	MaxRadiusKm    = 100
)

var ErrInvalid = errors.New("invalid profile")

type Area struct {
	Label    string  `json:"label,omitempty"`
	Lat      float64 `json:"lat"`
	Lng      float64 `json:"lng"`
	RadiusKm float64 `json:"radius_km"`
}

type Site struct {
	Kind       string   `json:"kind"`
	Label      string   `json:"label,omitempty"`
	Lat        *float64 `json:"lat,omitempty"`
	Lng        *float64 `json:"lng,omitempty"`
	FreeAreaM2 *float64 `json:"free_area_m2,omitempty"`
	Areas      []Area   `json:"areas,omitempty"`
	RadiusKm   *float64 `json:"radius_km,omitempty"`
}

type Onprem struct {
	Wanted bool  `json:"wanted"`
	Site   *Site `json:"site,omitempty"`
}

type Profile struct {
	Criteria onboarding.Criteria            `json:"criteria"`
	Onprem   Onprem                         `json:"onprem"`
	Projects map[string]onboarding.Criteria `json:"projects,omitempty"`
}

func Default() Profile {
	return Profile{
		Criteria: onboarding.Criteria{Focus: onboarding.FocusCost},
	}
}

func Check(profile Profile) error {
	if err := onboarding.CheckCriteria(profile.Criteria); err != nil {
		return fmt.Errorf("%w: %v", ErrInvalid, err)
	}
	for id, criteria := range profile.Projects {
		if err := onboarding.CheckCriteria(criteria); err != nil {
			return fmt.Errorf("%w: project %s: %v", ErrInvalid, id, err)
		}
	}
	site := profile.Onprem.Site
	if site == nil {
		if profile.Onprem.Wanted {
			return fmt.Errorf("%w: on-prem is wanted but has no site", ErrInvalid)
		}
		return nil
	}
	switch site.Kind {
	case "headquarters":
		if site.Label == "" || site.Lat == nil || site.Lng == nil || !onEarth(*site.Lat, *site.Lng) {
			return fmt.Errorf("%w: the headquarters needs a label and a point on Earth", ErrInvalid)
		}
		if site.FreeAreaM2 == nil || *site.FreeAreaM2 <= 0 || len(site.Areas) > 0 || site.RadiusKm != nil {
			return fmt.Errorf("%w: a headquarters site needs free_area_m2 and no search areas", ErrInvalid)
		}
	case "search":
		if len(site.Areas) < 1 || len(site.Areas) > MaxSearchAreas {
			return fmt.Errorf("%w: a search needs from 1 to %d areas", ErrInvalid, MaxSearchAreas)
		}
		if site.FreeAreaM2 != nil || site.Lat != nil || site.Lng != nil || site.RadiusKm != nil || site.Label != "" {
			return fmt.Errorf("%w: a search keeps its points in its areas and has no free_area_m2", ErrInvalid)
		}
		for i, area := range site.Areas {
			if !onEarth(area.Lat, area.Lng) || area.RadiusKm < MinRadiusKm || area.RadiusKm > MaxRadiusKm {
				return fmt.Errorf("%w: area %d needs a point on Earth and radius_km from %d to %d", ErrInvalid, i+1, MinRadiusKm, MaxRadiusKm)
			}
		}
	default:
		return fmt.Errorf("%w: site kind must be headquarters or search", ErrInvalid)
	}
	return nil
}

func onEarth(lat, lng float64) bool {
	return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

func withAreas(site *Site) {
	if site == nil || site.Kind != "search" || len(site.Areas) > 0 || site.Lat == nil || site.Lng == nil || site.RadiusKm == nil {
		return
	}
	site.Areas = []Area{{Label: site.Label, Lat: *site.Lat, Lng: *site.Lng, RadiusKm: *site.RadiusKm}}
	site.Label, site.Lat, site.Lng, site.RadiusKm = "", nil, nil, nil
}

type Store struct {
	mu   sync.Mutex
	path string
}

func Open(dir string) *Store {
	return &Store{path: filepath.Join(dir, fileName)}
}

func (s *Store) Profile() (Profile, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, err := os.ReadFile(s.path)
	if errors.Is(err, fs.ErrNotExist) {
		return Default(), nil
	}
	if err != nil {
		return Profile{}, err
	}
	var saved Profile
	if err := json.Unmarshal(data, &saved); err != nil {
		return Profile{}, fmt.Errorf("%s: %w", s.path, err)
	}
	withAreas(saved.Onprem.Site)
	if Check(saved) != nil {
		return Default(), nil
	}
	return saved, nil
}

func (s *Store) SaveProfile(profile Profile) error {
	if err := Check(profile); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return files.WriteAtomically(s.path, profile)
}
