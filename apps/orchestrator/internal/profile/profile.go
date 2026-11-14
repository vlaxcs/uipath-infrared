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

const fileName = "profile.json"

var ErrInvalid = errors.New("invalid profile")

type Site struct {
	Kind       string   `json:"kind"`
	Label      string   `json:"label"`
	Lat        float64  `json:"lat"`
	Lng        float64  `json:"lng"`
	RadiusKm   *float64 `json:"radius_km,omitempty"`
	FreeAreaM2 *float64 `json:"free_area_m2,omitempty"`
}

type Onprem struct {
	Wanted bool  `json:"wanted"`
	Site   *Site `json:"site,omitempty"`
}

type Profile struct {
	Criteria onboarding.Criteria `json:"criteria"`
	Onprem   Onprem              `json:"onprem"`
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
	site := profile.Onprem.Site
	if site == nil {
		if profile.Onprem.Wanted {
			return fmt.Errorf("%w: on-prem is wanted but has no site", ErrInvalid)
		}
		return nil
	}
	if site.Label == "" || site.Lat < -90 || site.Lat > 90 || site.Lng < -180 || site.Lng > 180 {
		return fmt.Errorf("%w: the site needs a label and a point on Earth", ErrInvalid)
	}
	switch site.Kind {
	case "headquarters":
		if site.FreeAreaM2 == nil || *site.FreeAreaM2 <= 0 || site.RadiusKm != nil {
			return fmt.Errorf("%w: a headquarters site needs free_area_m2 and no radius_km", ErrInvalid)
		}
	case "search":
		if site.RadiusKm == nil || *site.RadiusKm < 5 || *site.RadiusKm > 100 || site.FreeAreaM2 != nil {
			return fmt.Errorf("%w: a search needs radius_km from 5 to 100 and no free_area_m2", ErrInvalid)
		}
	default:
		return fmt.Errorf("%w: site kind must be headquarters or search", ErrInvalid)
	}
	return nil
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
