package riverui

import (
	"errors"
	"fmt"
	"strconv"
)

// int64String is an int64 type that marshals itself as a string and can
// unmarshal from a string to make sure that the use of the entire possible
// range of int64 is safe.
type int64String int64

func (i int64String) MarshalJSON() ([]byte, error) {
	return []byte(`"` + strconv.FormatInt(int64(i), 10) + `"`), nil
}

func (i *int64String) UnmarshalJSON(data []byte) error {
	if len(data) < 1 {
		return errors.New("can't unmarshal empty int64 string value")
	}

	str := string(data)
	if str[0] == '"' && len(str) > 1 {
		str = str[1 : len(str)-1]
	}

	parsedInt, err := strconv.ParseInt(str, 10, 64)
	if err != nil {
		return fmt.Errorf("error parsing int64 string: %w", err)
	}

	*i = int64String(parsedInt)
	return nil
}
