package validate

import (
	"reflect"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFromValidator(t *testing.T) {
	t.Parallel()

	// Fields have JSON tags so we can verify those are used over the
	// property name.
	type TestStruct struct {
		MinInt      int      `json:"min_int"     validate:"min=1"`
		MinSlice    []string `json:"min_slice"   validate:"min=1"`
		MinString   string   `json:"min_string"  validate:"min=1"`
		MaxInt      int      `json:"max_int"     validate:"max=0"`
		MaxSlice    []string `json:"max_slice"   validate:"max=0"`
		MaxString   string   `json:"max_string"  validate:"max=0"`
		OneOf       string   `json:"one_of"      validate:"oneof=blue green"`
		Required    string   `json:"required"    validate:"required"`
		Unsupported string   `json:"unsupported" validate:"e164"`
	}

	validTestStruct := func() *TestStruct {
		return &TestStruct{
			MinInt:      1,
			MinSlice:    []string{"1"},
			MinString:   "value",
			MaxInt:      0,
			MaxSlice:    []string{},
			MaxString:   "",
			OneOf:       "blue",
			Required:    "value",
			Unsupported: "+1123456789",
		}
	}

	t.Run("MaxInt", func(t *testing.T) {
		t.Parallel()

		testStruct := validTestStruct()
		testStruct.MaxInt = 1
		require.Equal(t, "Field `max_int` must be less than or equal to 0.", PublicFacingMessage(validate.Struct(testStruct)))
	})

	t.Run("MaxSlice", func(t *testing.T) {
		t.Parallel()

		testStruct := validTestStruct()
		testStruct.MaxSlice = []string{"1"}
		require.Equal(t, "Field `max_slice` must contain at most 0 element(s).", PublicFacingMessage(validate.Struct(testStruct)))
	})

	t.Run("MaxString", func(t *testing.T) {
		t.Parallel()

		testStruct := validTestStruct()
		testStruct.MaxString = "value"
		require.Equal(t, "Field `max_string` must be at most 0 character(s) long.", PublicFacingMessage(validate.Struct(testStruct)))
	})

	t.Run("MinInt", func(t *testing.T) {
		t.Parallel()

		testStruct := validTestStruct()
		testStruct.MinInt = 0
		require.Equal(t, "Field `min_int` must be greater or equal to 1.", PublicFacingMessage(validate.Struct(testStruct)))
	})

	t.Run("MinSlice", func(t *testing.T) {
		t.Parallel()

		testStruct := validTestStruct()
		testStruct.MinSlice = nil
		require.Equal(t, "Field `min_slice` must contain at least 1 element(s).", PublicFacingMessage(validate.Struct(testStruct)))
	})

	t.Run("MinString", func(t *testing.T) {
		t.Parallel()

		testStruct := validTestStruct()
		testStruct.MinString = ""
		require.Equal(t, "Field `min_string` must be at least 1 character(s) long.", PublicFacingMessage(validate.Struct(testStruct)))
	})

	t.Run("OneOf", func(t *testing.T) {
		t.Parallel()

		testStruct := validTestStruct()
		testStruct.OneOf = "red"
		require.Equal(t, "Field `one_of` should be one of the following values: blue green.", PublicFacingMessage(validate.Struct(testStruct)))
	})

	t.Run("Required", func(t *testing.T) {
		t.Parallel()

		testStruct := validTestStruct()
		testStruct.Required = ""
		require.Equal(t, "Field `required` is required.", PublicFacingMessage(validate.Struct(testStruct)))
	})

	t.Run("Unsupported", func(t *testing.T) {
		t.Parallel()

		testStruct := validTestStruct()
		testStruct.Unsupported = "abc"
		require.Equal(t, "Validation on field `unsupported` failed on the `e164` tag.", PublicFacingMessage(validate.Struct(testStruct)))
	})

	t.Run("MultipleErrors", func(t *testing.T) {
		t.Parallel()

		testStruct := validTestStruct()
		testStruct.MinInt = 0
		testStruct.Required = ""
		require.Equal(t, "Field `min_int` must be greater or equal to 1. Field `required` is required.", PublicFacingMessage(validate.Struct(testStruct)))
	})
}

func TestPreferPublicNames(t *testing.T) {
	t.Parallel()

	type testStruct struct {
		JSONNameField   string `json:"json_name"`
		StructNameField string `apiquery:"-"`
	}

	require.Equal(t, "json_name",
		preferPublicName(reflect.TypeOf(testStruct{}).Field(0)))
	require.Equal(t, "StructNameField",
		preferPublicName(reflect.TypeOf(testStruct{}).Field(1)))
}
