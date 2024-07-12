// Package apierror contains a variety of marshalable API errors that adhere to
// a unified error response convention.
package apierror

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
)

// APIError is a struct that's embedded on a more specific API error struct (as
// seen below), and which provides a JSON serialization and a wait to
// conveniently write itself to an HTTP response.
//
// APIErrorInterface should be used with errors.As instead of this struct.
type APIError struct {
	// InternalError is an additional error that might be associated with the
	// API error. It's not returned in the API error response, but is logged in
	// API endpoint execution to provide extra information for operators.
	InternalError error `json:"-"`

	// Message is a descriptive, human-friendly message indicating what went
	// wrong. Try to make error messages as actionable as possible to help the
	// caller easily fix what went wrong.
	Message string `json:"message"`

	// StatusCode is the API error's HTTP status code. It's not marshaled to
	// JSON, but determines how the error is written to a response.
	StatusCode int `json:"-"`
}

func (e *APIError) Error() string                      { return e.Message }
func (e *APIError) GetInternalError() error            { return e.InternalError }
func (e *APIError) SetInternalError(internalErr error) { e.InternalError = internalErr }

// Write writes the API error to an HTTP response, writing to the given logger
// in case of a problem.
func (e *APIError) Write(ctx context.Context, logger *slog.Logger, w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(e.StatusCode)

	respData, err := json.Marshal(e)
	if err != nil {
		logger.ErrorContext(ctx, "error marshaling API error", slog.String("error", err.Error()))
	}

	if _, err := w.Write(respData); err != nil {
		logger.ErrorContext(ctx, "error writing API error", slog.String("error", err.Error()))
	}
}

// Interface is an interface to an API error. This is needed for use with
// errors.As because APIError itself is emedded on another error struct, and
// won't be usable as an errors.As target.
type Interface interface {
	Error() string
	GetInternalError() error
	SetInternalError(internalErr error)
	Write(ctx context.Context, logger *slog.Logger, w http.ResponseWriter)
}

// WithInternalError is a convenience function for assigning an internal error
// to the given API error and returning it.
func WithInternalError[TAPIError Interface](apiErr TAPIError, internalErr error) TAPIError {
	apiErr.SetInternalError(internalErr)
	return apiErr
}

//
// BadRequest
//

type BadRequest struct {
	APIError
}

func NewBadRequest(format string, a ...any) *BadRequest {
	return &BadRequest{
		APIError: APIError{
			Message:    fmt.Sprintf(format, a...),
			StatusCode: http.StatusBadRequest,
		},
	}
}

//
// InternalServerError
//

type InternalServerError struct {
	APIError
}

func NewInternalServerError(format string, a ...any) *InternalServerError {
	return &InternalServerError{
		APIError: APIError{
			Message:    fmt.Sprintf(format, a...),
			StatusCode: http.StatusInternalServerError,
		},
	}
}

//
// NotFound
//

type NotFound struct {
	APIError
}

func NewNotFound(format string, a ...any) *NotFound {
	return &NotFound{
		APIError: APIError{
			Message:    fmt.Sprintf(format, a...),
			StatusCode: http.StatusNotFound,
		},
	}
}

func NewNotFoundJob(jobID int64) *NotFound    { return NewNotFound("Job not found: %d.", jobID) }
func NewNotFoundQueue(name string) *NotFound  { return NewNotFound("Queue not found: %s.", name) }
func NewNotFoundWorkflow(id string) *NotFound { return NewNotFound("Workflow not found: %s.", id) }

//
// ServiceUnavailable
//

type ServiceUnavailable struct {
	APIError
}

func NewServiceUnavailable(format string, a ...any) *ServiceUnavailable {
	return &ServiceUnavailable{
		APIError: APIError{
			Message:    fmt.Sprintf(format, a...),
			StatusCode: http.StatusServiceUnavailable,
		},
	}
}
