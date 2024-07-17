package apimiddleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

// Verify MiddlewareFunc complies with middlewareInterface.
var _ middlewareInterface = MiddlewareFunc(func(next http.Handler) http.Handler {
	return next
})

type contextTrailContextKey struct{}

// Adds the configured segment to trail in context.
type contextTrailMiddleware struct {
	segment string
}

func newContextTrailMiddleware(segment string) *contextTrailMiddleware {
	return &contextTrailMiddleware{segment: segment}
}

func (m *contextTrailMiddleware) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		// Extract
		var contextTrail []string
		if existingTrail, ok := ctx.Value(contextTrailContextKey{}).([]string); ok {
			contextTrail = existingTrail
		}
		contextTrail = append(contextTrail, m.segment)

		next.ServeHTTP(w, r.WithContext(context.WithValue(ctx, contextTrailContextKey{}, contextTrail)))
	})
}

func TestMiddlewareStack(t *testing.T) {
	t.Parallel()

	makeRequestAndExtractTrail := func(stack *MiddlewareStack) []string {
		var contextTrail []string

		handler := stack.Mount(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
			contextTrail = r.Context().Value(contextTrailContextKey{}).([]string) //nolint:forcetypeassert
		}))

		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "https://example.com", nil)
		handler.ServeHTTP(recorder, req)

		return contextTrail
	}

	t.Run("NewMiddlewareStack", func(t *testing.T) {
		t.Parallel()

		stack := NewMiddlewareStack(
			newContextTrailMiddleware("1st"),
			newContextTrailMiddleware("2nd"),
			newContextTrailMiddleware("3rd"),
		)

		contextTrail := makeRequestAndExtractTrail(stack)
		require.Equal(t, []string{"1st", "2nd", "3rd"}, contextTrail)
	})

	t.Run("Use", func(t *testing.T) {
		t.Parallel()

		stack := &MiddlewareStack{}
		stack.Use(newContextTrailMiddleware("1st"))
		stack.Use(newContextTrailMiddleware("2nd"))
		stack.Use(newContextTrailMiddleware("3rd"))

		contextTrail := makeRequestAndExtractTrail(stack)
		require.Equal(t, []string{"1st", "2nd", "3rd"}, contextTrail)
	})
}
