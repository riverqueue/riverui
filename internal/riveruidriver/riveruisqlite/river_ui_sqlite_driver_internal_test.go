package riveruisqlite

import (
	"encoding/hex"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/riverqueue/river/rivertype"
)

func TestParseJobCountEstimateStat4(t *testing.T) {
	t.Parallel()

	requestedStates := map[rivertype.JobState]struct{}{
		rivertype.JobStateCompleted: {},
		rivertype.JobStateRunning:   {},
	}
	samples := "100 1 1:" + sqliteRecordTextHex("completed") +
		"|10 1 1:" + sqliteRecordTextHex("running") +
		"|5 1 1:" + sqliteRecordTextHex("available") +
		"|100 1 1:" + sqliteRecordTextHex("completed")

	estimates, err := parseJobCountEstimateStat4(samples, requestedStates)
	require.NoError(t, err)
	require.Len(t, estimates, 2)
	require.Equal(t, 100, estimates[rivertype.JobStateCompleted].Count)
	require.Nil(t, estimates[rivertype.JobStateCompleted].ObservedAt)
	require.Equal(t, 10, estimates[rivertype.JobStateRunning].Count)
}

func TestParseJobCountEstimateStat4Empty(t *testing.T) {
	t.Parallel()

	estimates, err := parseJobCountEstimateStat4("", map[rivertype.JobState]struct{}{
		rivertype.JobStateCompleted: {},
	})
	require.NoError(t, err)
	require.Empty(t, estimates)
}

func TestParseJobCountEstimateStat4RejectsInconsistentSamples(t *testing.T) {
	t.Parallel()

	sample := sqliteRecordTextHex("completed")
	_, err := parseJobCountEstimateStat4("100 1:"+sample+"|99 1:"+sample, map[rivertype.JobState]struct{}{
		rivertype.JobStateCompleted: {},
	})
	require.EqualError(t, err, `inconsistent STAT4 counts for state "completed": 100 and 99`)
}

func TestSQLiteRecordFirstText(t *testing.T) {
	t.Parallel()

	record, err := hex.DecodeString(sqliteRecordTextHex("completed"))
	require.NoError(t, err)
	value, err := sqliteRecordFirstText(record)
	require.NoError(t, err)
	require.Equal(t, "completed", value)

	for _, testCase := range []struct {
		name   string
		record []byte
	}{
		{name: "Empty", record: nil},
		{name: "InvalidHeaderSize", record: []byte{0x03, 0x0f}},
		{name: "TruncatedSerialType", record: []byte{0x02, 0x80}},
		{name: "NonText", record: []byte{0x02, 0x01, 0x01}},
		{name: "TruncatedText", record: append([]byte{0x02, 0x1f}, []byte("short")...)},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()
			_, err := sqliteRecordFirstText(testCase.record)
			require.Error(t, err)
		})
	}
}

// sqliteRecordTextHex returns a minimal one-column SQLite record containing a
// text value. All River states are short enough for one-byte header varints.
func sqliteRecordTextHex(value string) string {
	serialTypes := map[string]byte{
		"available": 0x1f,
		"completed": 0x1f,
		"running":   0x1b,
	}
	record := append([]byte{0x02, serialTypes[value]}, []byte(value)...)
	return hex.EncodeToString(record)
}
