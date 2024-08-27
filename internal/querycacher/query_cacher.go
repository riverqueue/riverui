package querycacher

import (
	"context"
	"regexp"
	"sync"
	"time"

	"github.com/riverqueue/river/rivershared/baseservice"
	"github.com/riverqueue/river/rivershared/startstop"

	"riverqueue.com/riverui/internal/dbsqlc"
)

// QueryCacher executes a database query periodically and caches the result. The
// basic premise is that given large River databases even simple queries like
// counting job rows can get quite slow. This construct operates as a background
// service that runs a query, stores the result, making it available to API
// endpoints so that they don't need to execute the query in band.
type QueryCacher[TRes any] struct {
	baseservice.BaseService
	startstop.BaseStartStop

	cachedRes        TRes
	cachedResSet     bool
	db               dbsqlc.DBTX
	mu               sync.RWMutex
	runQuery         func(ctx context.Context, dbtx dbsqlc.DBTX) (TRes, error)
	runQueryTestChan chan struct{} // closed when query is run; for testing
	tickPeriod       time.Duration // constant normally, but settable for testing
}

func NewQueryCacher[TRes any](archetype *baseservice.Archetype, db dbsqlc.DBTX, runQuery func(ctx context.Context, db dbsqlc.DBTX) (TRes, error)) *QueryCacher[TRes] {
	// +/- 1s random variance to ticker interval. Makes sure that given multiple
	// query caches running simultaneously, they all start and are scheduled a
	// little differently to make a thundering herd problem less likely.
	randomTickVariance := time.Duration(archetype.Rand.Float64()*float64(2*time.Second)) - 1*time.Second

	queryCacher := baseservice.Init(archetype, &QueryCacher[TRes]{
		db:         db,
		runQuery:   runQuery,
		tickPeriod: 10*time.Second + randomTickVariance,
	})

	// TODO(brandur): Push this up into baseservice.
	queryCacher.Name = simplifyArchetypeLogName(queryCacher.Name)

	return queryCacher
}

// CachedRes returns cached results, if there are any, and an "ok" boolean
// indicating whether cached results were available (true if so, and false
// otherwise).
func (s *QueryCacher[TRes]) CachedRes() (TRes, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if !s.cachedResSet {
		var emptyRes TRes
		return emptyRes, false
	}

	return s.cachedRes, true
}

// RunQuery runs the internal query function and caches the result. It's not
// usually necessary to call this function explicitly since Start will do it
// periodically, but is made available for use in places like helping with
// testing.
func (s *QueryCacher[TRes]) RunQuery(ctx context.Context) (TRes, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	start := time.Now()

	res, err := s.runQuery(ctx, s.db)
	if err != nil {
		var emptyRes TRes
		return emptyRes, err
	}

	s.Logger.DebugContext(ctx, s.Name+": Ran query and cached result", "duration", time.Since(start), "tick_period", s.tickPeriod)

	s.mu.Lock()
	s.cachedRes = res
	s.cachedResSet = true
	s.mu.Unlock()

	// Tells a test that it can wake up and handle a result.
	if s.runQueryTestChan != nil {
		close(s.runQueryTestChan)
		s.runQueryTestChan = nil
	}

	return res, nil
}

// Start starts the service, causing it to periodically run its query and cache
// the result. It stops when Stop is called or if its context is cancelled.
func (s *QueryCacher[TRes]) Start(ctx context.Context) error {
	ctx, shouldStart, started, stopped := s.StartInit(ctx)
	if !shouldStart {
		return nil
	}

	go func() {
		started()
		defer stopped()

		// In case a query runs long and exceeds tickPeriod, time.Ticker will
		// drop ticks to compensate.
		ticker := time.NewTicker(s.tickPeriod)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return

			case <-ticker.C:
				if _, err := s.RunQuery(ctx); err != nil {
					s.Logger.ErrorContext(ctx, s.Name+": Error running query", "err", err)
				}
			}
		}
	}()

	return nil
}

// Simplifies the name of a Go type that uses generics for cleaner logging output.
//
// So this:
//
//	QueryCacher[[]*riverqueue.com/riverui/internal/dbsqlc.JobCountByStateRow]
//
// Becomes this:
//
//	QueryCacher[[]*dbsqlc.JobCountByStateRow]
//
// TODO(brandur): Push this up into baseservice.
func simplifyArchetypeLogName(name string) string {
	re := regexp.MustCompile(`\[([\[\]\*]*).*/([^/]+)\]`)
	return re.ReplaceAllString(name, `[$1$2]`)
}
