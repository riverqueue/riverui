// Package validate internalizes Go Playground's Validator framework, setting
// some common options that we use everywhere, providing some useful helpers,
// and exporting a simplified API.
package validate

import (
	"context"
	"fmt"
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"
)

// WithRequiredStructEnabled can be removed once validator/v11 is released.
var validate = validator.New(validator.WithRequiredStructEnabled()) //nolint:gochecknoglobals

func init() { //nolint:gochecknoinits
	validate.RegisterTagNameFunc(preferPublicName)
}

// PublicFacingMessage builds a complete error message from a validator error
// that's suitable for public-facing consumption.
//
// I only added a few possible validations to start. We'll probably need to add
// more as we go and expand our usage.
func PublicFacingMessage(validatorErr error) string {
	var message string

	//nolint:errorlint
	if validationErrs, ok := validatorErr.(validator.ValidationErrors); ok {
		for _, fieldErr := range validationErrs {
			switch fieldErr.Tag() {
			case "lte":
				fallthrough // lte and max are synonyms
			case "max":
				kind := fieldErr.Kind()
				if kind == reflect.Ptr {
					kind = fieldErr.Type().Elem().Kind()
				}

				switch kind {
				case reflect.Float32, reflect.Float64, reflect.Int, reflect.Int32, reflect.Int64:
					message += fmt.Sprintf(" Field `%s` must be less than or equal to %s.",
						fieldErr.Field(), fieldErr.Param())

				case reflect.Slice, reflect.Map:
					message += fmt.Sprintf(" Field `%s` must contain at most %s element(s).",
						fieldErr.Field(), fieldErr.Param())

				case reflect.String:
					message += fmt.Sprintf(" Field `%s` must be at most %s character(s) long.",
						fieldErr.Field(), fieldErr.Param())

				default:
					message += fieldErr.Error()
				}

			case "gte":
				fallthrough // gte and min are synonyms
			case "min":
				kind := fieldErr.Kind()
				if kind == reflect.Ptr {
					kind = fieldErr.Type().Elem().Kind()
				}

				switch kind {
				case reflect.Float32, reflect.Float64, reflect.Int, reflect.Int32, reflect.Int64:
					message += fmt.Sprintf(" Field `%s` must be greater or equal to %s.",
						fieldErr.Field(), fieldErr.Param())

				case reflect.Slice, reflect.Map:
					message += fmt.Sprintf(" Field `%s` must contain at least %s element(s).",
						fieldErr.Field(), fieldErr.Param())

				case reflect.String:
					message += fmt.Sprintf(" Field `%s` must be at least %s character(s) long.",
						fieldErr.Field(), fieldErr.Param())

				default:
					message += fieldErr.Error()
				}

			case "oneof":
				message += fmt.Sprintf(" Field `%s` should be one of the following values: %s.",
					fieldErr.Field(), fieldErr.Param())

			case "required":
				message += fmt.Sprintf(" Field `%s` is required.", fieldErr.Field())

			default:
				message += fmt.Sprintf(" Validation on field `%s` failed on the `%s` tag.", fieldErr.Field(), fieldErr.Tag())
			}
		}
	}

	return strings.TrimSpace(message)
}

// StructCtx validates a structs exposed fields, and automatically validates
// nested structs, unless otherwise specified and also allows passing of
// context.Context for contextual validation information.
func StructCtx(ctx context.Context, s any) error {
	return validate.StructCtx(ctx, s)
}

// preferPublicName is a validator tag naming function that uses public names
// like a field's JSON tag instead of actual field names in structs.
// This is important because we sent these back as user-facing errors (and the
// users submitted them as JSON/path parameters).
func preferPublicName(fld reflect.StructField) string {
	name, _, _ := strings.Cut(fld.Tag.Get("json"), ",")
	if name != "" && name != "-" {
		return name
	}

	return fld.Name
}
