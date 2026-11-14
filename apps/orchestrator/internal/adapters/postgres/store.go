package postgres

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"infrared/orchestrator/internal/auth"
)

const migrationLock = 7_340_101

//go:embed migrations/*.sql
var migrations embed.FS

type Store struct {
	pool *pgxpool.Pool
}

func Open(ctx context.Context, databaseURL string) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("database: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("database: %w", err)
	}
	if err := migrate(ctx, pool); err != nil {
		pool.Close()
		return nil, fmt.Errorf("database migrations: %w", err)
	}
	return &Store{pool: pool}, nil
}

func (s *Store) Close() {
	s.pool.Close()
}

func (s *Store) SignIn(ctx context.Context, identity auth.Identity, tokenHash []byte, expiresAt time.Time) error {
	_, err := s.pool.Exec(ctx, `
		WITH signed_in AS (
			INSERT INTO users (github_id, login, avatar_url) VALUES ($1, $2, $3)
			ON CONFLICT (github_id) DO UPDATE SET login = EXCLUDED.login, avatar_url = EXCLUDED.avatar_url, updated_at = now()
			RETURNING id
		)
		INSERT INTO sessions (token_hash, user_id, expires_at) SELECT $4, id, $5 FROM signed_in`,
		identity.GithubID, identity.Login, identity.AvatarURL, tokenHash, expiresAt)
	return err
}

func (s *Store) UserBySession(ctx context.Context, tokenHash []byte, at time.Time) (auth.User, error) {
	var user auth.User
	err := s.pool.QueryRow(ctx, `
		SELECT u.id, u.login, u.avatar_url, u.credits
		FROM sessions s JOIN users u ON u.id = s.user_id
		WHERE s.token_hash = $1 AND s.expires_at > $2`,
		tokenHash, at).Scan(&user.ID, &user.Login, &user.AvatarURL, &user.Credits)
	if errors.Is(err, pgx.ErrNoRows) {
		return auth.User{}, auth.ErrNoSession
	}
	return user, err
}

func (s *Store) EndSession(ctx context.Context, tokenHash []byte) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM sessions WHERE token_hash = $1`, tokenHash)
	return err
}

func (s *Store) DeleteExpired(ctx context.Context, at time.Time) (int64, error) {
	tag, err := s.pool.Exec(ctx, `DELETE FROM sessions WHERE expires_at <= $1`, at)
	return tag.RowsAffected(), err
}

type migration struct {
	version int
	sql     string
}

func migrate(ctx context.Context, pool *pgxpool.Pool) error {
	pending, err := embedded()
	if err != nil {
		return err
	}
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()
	if _, err := conn.Exec(ctx, `SELECT pg_advisory_lock($1)`, migrationLock); err != nil {
		return err
	}
	defer conn.Exec(context.WithoutCancel(ctx), `SELECT pg_advisory_unlock($1)`, migrationLock)

	if _, err := conn.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`); err != nil {
		return err
	}
	applied := map[int]bool{}
	rows, err := conn.Query(ctx, `SELECT version FROM schema_migrations`)
	if err != nil {
		return err
	}
	versions, err := pgx.CollectRows(rows, pgx.RowTo[int])
	if err != nil {
		return err
	}
	for _, version := range versions {
		applied[version] = true
	}
	for _, next := range pending {
		if applied[next.version] {
			continue
		}
		if err := pgx.BeginFunc(ctx, conn, func(tx pgx.Tx) error {
			if _, err := tx.Exec(ctx, next.sql); err != nil {
				return err
			}
			_, err := tx.Exec(ctx, `INSERT INTO schema_migrations (version) VALUES ($1)`, next.version)
			return err
		}); err != nil {
			return fmt.Errorf("version %d: %w", next.version, err)
		}
	}
	return nil
}

func embedded() ([]migration, error) {
	names, err := fs.Glob(migrations, "migrations/*.sql")
	if err != nil {
		return nil, err
	}
	found := make([]migration, 0, len(names))
	for _, name := range names {
		base := strings.TrimPrefix(name, "migrations/")
		version, err := strconv.Atoi(strings.SplitN(base, "_", 2)[0])
		if err != nil {
			return nil, fmt.Errorf("%s: the name must start with its version number", base)
		}
		sql, err := migrations.ReadFile(name)
		if err != nil {
			return nil, err
		}
		found = append(found, migration{version: version, sql: string(sql)})
	}
	sort.Slice(found, func(i, j int) bool { return found[i].version < found[j].version })
	return found, nil
}
