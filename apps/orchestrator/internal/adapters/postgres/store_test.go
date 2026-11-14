package postgres_test

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/url"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"infrared/orchestrator/internal/adapters/postgres"
	"infrared/orchestrator/internal/auth"
)

var now = time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)

func testDatabase(t *testing.T) string {
	t.Helper()
	base := os.Getenv("ORCHESTRATOR_TEST_DATABASE_URL")
	if base == "" {
		t.Skip("ORCHESTRATOR_TEST_DATABASE_URL is not set")
	}
	suffix := make([]byte, 6)
	rand.Read(suffix)
	schema := "test_" + hex.EncodeToString(suffix)

	conn, err := pgx.Connect(context.Background(), base)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := conn.Exec(context.Background(), "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		conn.Exec(context.Background(), "DROP SCHEMA "+schema+" CASCADE")
		conn.Close(context.Background())
	})

	parsed, err := url.Parse(base)
	if err != nil {
		t.Fatal(err)
	}
	query := parsed.Query()
	query.Set("search_path", schema)
	parsed.RawQuery = query.Encode()
	return parsed.String()
}

func open(t *testing.T, databaseURL string) *postgres.Store {
	t.Helper()
	store, err := postgres.Open(context.Background(), databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(store.Close)
	return store
}

var octocat = auth.Identity{GithubID: 583231, Login: "octocat", AvatarURL: "https://avatars.test/583231"}

func TestASignedInSessionFindsItsUserWithFiveCredits(t *testing.T) {
	store := open(t, testDatabase(t))
	ctx := context.Background()
	if err := store.SignIn(ctx, octocat, auth.Hash("token"), now.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	user, err := store.UserBySession(ctx, auth.Hash("token"), now)
	if err != nil {
		t.Fatal(err)
	}
	if user.Login != "octocat" || user.AvatarURL != octocat.AvatarURL || user.Credits != 5 || user.ID == 0 {
		t.Fatalf("user %+v", user)
	}
}

func TestSigningInAgainUpdatesTheProfileAndKeepsOneUser(t *testing.T) {
	store := open(t, testDatabase(t))
	ctx := context.Background()
	store.SignIn(ctx, octocat, auth.Hash("first"), now.Add(time.Hour))
	renamed := auth.Identity{GithubID: octocat.GithubID, Login: "octo-renamed", AvatarURL: "https://avatars.test/new"}
	if err := store.SignIn(ctx, renamed, auth.Hash("second"), now.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	first, err := store.UserBySession(ctx, auth.Hash("first"), now)
	if err != nil {
		t.Fatal(err)
	}
	second, err := store.UserBySession(ctx, auth.Hash("second"), now)
	if err != nil {
		t.Fatal(err)
	}
	if first.ID != second.ID || first.Login != "octo-renamed" || second.AvatarURL != "https://avatars.test/new" {
		t.Fatalf("first %+v, second %+v", first, second)
	}
}

func TestAnExpiredSessionIsNoSession(t *testing.T) {
	store := open(t, testDatabase(t))
	ctx := context.Background()
	store.SignIn(ctx, octocat, auth.Hash("token"), now)
	if _, err := store.UserBySession(ctx, auth.Hash("token"), now); !errors.Is(err, auth.ErrNoSession) {
		t.Fatalf("at expiry: %v", err)
	}
	if _, err := store.UserBySession(ctx, auth.Hash("unknown"), now); !errors.Is(err, auth.ErrNoSession) {
		t.Fatalf("unknown: %v", err)
	}
}

func TestEndingASessionLeavesTheOthers(t *testing.T) {
	store := open(t, testDatabase(t))
	ctx := context.Background()
	store.SignIn(ctx, octocat, auth.Hash("laptop"), now.Add(time.Hour))
	store.SignIn(ctx, octocat, auth.Hash("phone"), now.Add(time.Hour))
	if err := store.EndSession(ctx, auth.Hash("laptop")); err != nil {
		t.Fatal(err)
	}
	if _, err := store.UserBySession(ctx, auth.Hash("laptop"), now); !errors.Is(err, auth.ErrNoSession) {
		t.Fatalf("ended: %v", err)
	}
	if _, err := store.UserBySession(ctx, auth.Hash("phone"), now); err != nil {
		t.Fatalf("other: %v", err)
	}
}

func TestTheSweepDeletesOnlyExpiredSessions(t *testing.T) {
	store := open(t, testDatabase(t))
	ctx := context.Background()
	store.SignIn(ctx, octocat, auth.Hash("old"), now.Add(-time.Minute))
	store.SignIn(ctx, octocat, auth.Hash("live"), now.Add(time.Hour))
	deleted, err := store.DeleteExpired(ctx, now)
	if err != nil || deleted != 1 {
		t.Fatalf("deleted %d, error %v", deleted, err)
	}
	if _, err := store.UserBySession(ctx, auth.Hash("live"), now); err != nil {
		t.Fatalf("live: %v", err)
	}
}

func TestOpeningTwiceAtOnceMigratesOnce(t *testing.T) {
	databaseURL := testDatabase(t)
	var wait sync.WaitGroup
	errs := make([]error, 4)
	for i := range errs {
		wait.Add(1)
		go func() {
			defer wait.Done()
			store, err := postgres.Open(context.Background(), databaseURL)
			if err == nil {
				store.Close()
			}
			errs[i] = err
		}()
	}
	wait.Wait()
	for i, err := range errs {
		if err != nil {
			t.Fatalf("open %d: %v", i, err)
		}
	}
	open(t, databaseURL)
}
