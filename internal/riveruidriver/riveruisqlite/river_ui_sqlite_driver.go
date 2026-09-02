// Package riveruisqlite implements River UI's database operations for SQLite.
package riveruisqlite

import (
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"

	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/rivershared/sqlctemplate"
	"github.com/riverqueue/river/rivershared/util/dbutil"
	"github.com/riverqueue/river/rivertype"

	"riverqueue.com/riverui/internal/riveruidriver"
	"riverqueue.com/riverui/internal/riveruidriver/riveruisqlite/internal/dbsqlc"
)

type Driver struct{}

// New returns a SQLite River UI driver. Unlike River's primary database
// driver, it doesn't take a pool because River UI only adds queries on top of
// the executor already owned by the caller's River client.
func New() *Driver {
	return &Driver{}
}

func (*Driver) GetExecutor(riverExecutor riverdriver.Executor) riveruidriver.Executor {
	return &Executor{
		Executor: riverExecutor,
		dbtx:     riverExecutorWrapper{executor: riverExecutor},
	}
}

type Executor struct {
	riverdriver.Executor

	dbtx riverExecutorWrapper
}

var (
	_ riveruidriver.Driver   = (*Driver)(nil)
	_ riveruidriver.Executor = (*Executor)(nil)
)

func (e *Executor) JobCountByAllStatesCapped(ctx context.Context, params *riveruidriver.JobCountByAllStatesCappedParams) (map[rivertype.JobState]int, error) {
	if params.Max < 1 {
		return nil, errors.New("count max must be positive")
	}
	if params.Max >= math.MaxInt32 {
		return nil, errors.New("count max is too large")
	}

	row, err := dbsqlc.JobCountByAllStatesCappedRiver(schemaTemplateParam(ctx, params.Schema), e.dbtx, int64(params.Max+1))
	if err != nil {
		return nil, fmt.Errorf("error counting jobs by state: %w", err)
	}

	return countsByState(row.Available, row.Cancelled, row.Completed, row.Discarded, row.Pending, row.Retryable, row.Running, row.Scheduled), nil
}

func (e *Executor) JobCountEstimate(ctx context.Context, params *riveruidriver.JobCountEstimateParams) (map[rivertype.JobState]riveruidriver.JobCountEstimateResult, error) {
	requestedStates := make(map[rivertype.JobState]struct{}, len(params.States))
	for _, state := range params.States {
		switch state {
		case rivertype.JobStateAvailable,
			rivertype.JobStateCancelled,
			rivertype.JobStateCompleted,
			rivertype.JobStateDiscarded,
			rivertype.JobStatePending,
			rivertype.JobStateRetryable,
			rivertype.JobStateRunning,
			rivertype.JobStateScheduled:
		default:
			return nil, fmt.Errorf("invalid job state for count estimate: %q", state)
		}
		requestedStates[state] = struct{}{}
	}

	// SQLITE_ENABLE_STAT4 makes a full ANALYZE retain a few encoded samples from
	// each index. It is a non-default compile-time feature that most SQLite
	// builds omit, and approximate ANALYZE (including the bounded analysis used
	// by modern PRAGMA optimize) does not populate it. This is therefore an
	// opportunistic, rarely used fast path; the capped query remains the normal
	// SQLite behavior.
	//
	// When STAT4 is available, the first nEq number for River's prioritized
	// fetching index is the number of rows matching the sample's leading state.
	// Reading those samples is constant-sized and avoids scanning the job index.
	stat4Exists, err := e.TableExists(ctx, &riverdriver.TableExistsParams{
		Schema: params.Schema,
		Table:  "sqlite_stat4",
	})
	if err != nil {
		return nil, fmt.Errorf("error checking for SQLite STAT4 count estimates: %w", err)
	}
	if !stat4Exists {
		return map[rivertype.JobState]riveruidriver.JobCountEstimateResult{}, nil
	}

	samples, err := dbsqlc.JobCountEstimateStat4River(schemaTemplateParam(ctx, params.Schema), e.dbtx)
	if err != nil {
		return nil, fmt.Errorf("error reading SQLite STAT4 count estimates: %w", err)
	}

	estimates, err := parseJobCountEstimateStat4(samples, requestedStates)
	if err != nil {
		return nil, fmt.Errorf("error decoding SQLite STAT4 count estimates: %w", err)
	}
	return estimates, nil
}

func parseJobCountEstimateStat4(samples string, requestedStates map[rivertype.JobState]struct{}) (map[rivertype.JobState]riveruidriver.JobCountEstimateResult, error) {
	estimates := make(map[rivertype.JobState]riveruidriver.JobCountEstimateResult, len(requestedStates))
	if samples == "" {
		return estimates, nil
	}

	for sampleAndCount := range strings.SplitSeq(samples, "|") {
		countFields, sampleHex, ok := strings.Cut(sampleAndCount, ":")
		if !ok {
			return nil, errors.New("STAT4 sample has no count separator")
		}

		countText, _, _ := strings.Cut(countFields, " ")
		count, err := strconv.Atoi(countText)
		if err != nil || count < 0 {
			return nil, fmt.Errorf("invalid STAT4 count %q", countText)
		}

		sample, err := hex.DecodeString(sampleHex)
		if err != nil {
			return nil, fmt.Errorf("invalid STAT4 sample encoding: %w", err)
		}
		stateText, err := sqliteRecordFirstText(sample)
		if err != nil {
			return nil, fmt.Errorf("invalid STAT4 record: %w", err)
		}
		state := rivertype.JobState(stateText)
		if _, requested := requestedStates[state]; !requested {
			continue
		}

		if previous, exists := estimates[state]; exists && previous.Count != count {
			return nil, fmt.Errorf("inconsistent STAT4 counts for state %q: %d and %d", state, previous.Count, count)
		}
		estimates[state] = riveruidriver.JobCountEstimateResult{Count: count}
	}

	return estimates, nil
}

// sqliteRecordFirstText decodes the leading text value from SQLite's compact
// record format. sqlite_stat4.sample stores the complete indexed row in this
// format, with the job state first in River's prioritized fetching index.
func sqliteRecordFirstText(record []byte) (string, error) {
	headerSize, headerVarintSize, err := sqliteVarint(record)
	if err != nil {
		return "", err
	}
	if headerSize > math.MaxInt {
		return "", fmt.Errorf("invalid header size %d", headerSize)
	}
	headerSizeInt := int(headerSize)
	if headerSizeInt < headerVarintSize || headerSizeInt > len(record) {
		return "", fmt.Errorf("invalid header size %d", headerSize)
	}

	serialType, serialTypeSize, err := sqliteVarint(record[headerVarintSize:])
	if err != nil {
		return "", err
	}
	if headerVarintSize+serialTypeSize > headerSizeInt {
		return "", errors.New("serial type extends past record header")
	}
	if serialType < 13 || serialType%2 == 0 {
		return "", fmt.Errorf("leading value has non-text serial type %d", serialType)
	}

	textSize := (serialType - 13) / 2
	if textSize > math.MaxInt {
		return "", errors.New("text value is too large")
	}
	textSizeInt := int(textSize)
	if textSizeInt > len(record)-headerSizeInt {
		return "", errors.New("text value extends past record data")
	}
	return string(record[headerSizeInt : headerSizeInt+textSizeInt]), nil
}

func sqliteVarint(data []byte) (uint64, int, error) {
	var value uint64
	for i := range 8 {
		if i >= len(data) {
			return 0, 0, errors.New("truncated varint")
		}
		value = value<<7 | uint64(data[i]&0x7f)
		if data[i]&0x80 == 0 {
			return value, i + 1, nil
		}
	}
	if len(data) < 9 {
		return 0, 0, errors.New("truncated varint")
	}
	return value<<8 | uint64(data[8]), 9, nil
}

func countsByState(available, cancelled, completed, discarded, pending, retryable, running, scheduled int64) map[rivertype.JobState]int {
	return map[rivertype.JobState]int{
		rivertype.JobStateAvailable: int(available),
		rivertype.JobStateCancelled: int(cancelled),
		rivertype.JobStateCompleted: int(completed),
		rivertype.JobStateDiscarded: int(discarded),
		rivertype.JobStatePending:   int(pending),
		rivertype.JobStateRetryable: int(retryable),
		rivertype.JobStateRunning:   int(running),
		rivertype.JobStateScheduled: int(scheduled),
	}
}

func schemaTemplateParam(ctx context.Context, schema string) context.Context {
	if schema != "" {
		schema = dbutil.SafeIdentifier(schema) + "."
	}

	return sqlctemplate.WithReplacements(ctx, map[string]sqlctemplate.Replacement{
		"schema": {Value: schema, Stable: true},
	}, nil)
}

type riverExecutorWrapper struct {
	executor riverdriver.Executor
}

func (w riverExecutorWrapper) QueryRow(ctx context.Context, query string, args ...any) dbsqlc.Row {
	// River's executor owns the dialect-specific sqlctemplate wrapper, so pass
	// the query and context through unchanged and let it consume the template.
	return w.executor.QueryRow(ctx, query, args...)
}
