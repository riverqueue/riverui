package apimiddleware

import (
	"net/http"
)

// middlewareInterface is an interface to be implemented by middleware.
type middlewareInterface interface {
	Middleware(next http.Handler) http.Handler
}

// MiddlewareFunc allows a simple middleware to be defined as only a function.
type MiddlewareFunc func(next http.Handler) http.Handler

// Middleware allows MiddlewareFunc to implement middlewareInterface.
func (f MiddlewareFunc) Middleware(next http.Handler) http.Handler {
	return f(next)
}

// MiddlewareStack builds a stack of middleware that a request will be
// dispatched through before sending it to the underlying handler. Middlewares
// are added to it before getting a handler with a call to Mount on another
// handler like a ServeMux.
// used like:
//
//	middlewares := &MiddlewareStack
//	middlewares.Use(middleware1)
//	middlewares.Use(middleware2)
//	...
//	handler := middlewares.Mount(mux)
//
// Besides some slight syntactic nicety, the entire reason this type exists is
// because it will mount middlewares in a more human-friendly/intuitive order.
// When mounting middlewares (not using MiddlewareStack) like:
//
//	handler := mux
//	handler = middleware1.Wrapper(handler)
//	handler = middleware2.Wrapper(handler)
//	...
//
// One must be very careful because the middlewares will be "backwards"
// according to the list in that when a request enters the stack, the middleware
// that was mounted first will be called _last_ because it's nested the deepest
// down.
//
// MiddlewareStack fixes this problem by enabling any number of middlewares to
// be specified, and then mounting them in inverted order when Mount is called.
type MiddlewareStack struct {
	middlewares []middlewareInterface
}

// NewMiddlewareStack is a helper that can act as a shortcut to initialize a
// middleware stack by passing a series of middlewares as variadic args.
func NewMiddlewareStack(middlewares ...middlewareInterface) *MiddlewareStack {
	stack := &MiddlewareStack{}
	for _, mw := range middlewares {
		stack.Use(mw)
	}
	return stack
}

func (s *MiddlewareStack) Mount(handler http.Handler) http.Handler {
	for i := len(s.middlewares) - 1; i >= 0; i-- {
		handler = s.middlewares[i].Middleware(handler)
	}
	return handler
}

func (s *MiddlewareStack) Use(middleware middlewareInterface) {
	s.middlewares = append(s.middlewares, middleware)
}
