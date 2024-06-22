package riverui

import (
	"encoding/json"
	"math"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestInt64String(t *testing.T) {
	t.Parallel()

	t.Run("MarshalJSON", func(t *testing.T) {
		t.Parallel()

		require.Equal(t, `"123"`, string(mustMarshalJSON(t, int64String(123))))
	})

	t.Run("UnmarshalJSON", func(t *testing.T) {
		t.Parallel()

		var myLargeInt int64String

		// With quotes.
		require.NoError(t, json.Unmarshal([]byte(`"123"`), &myLargeInt))
		require.Equal(t, int64String(123), myLargeInt)

		// Without quotes.
		require.NoError(t, json.Unmarshal([]byte(`123`), &myLargeInt))
		require.Equal(t, int64String(123), myLargeInt)

		// Integer larger than JSON's maximum number size.
		require.NoError(t, json.Unmarshal([]byte(`"`+strconv.FormatInt(math.MaxInt64, 10)+`"`), &myLargeInt))
		require.Equal(t, int64String(math.MaxInt64), myLargeInt)
	})
}
