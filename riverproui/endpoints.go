package riverproui

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/riverqueue/apiframe/apiendpoint"
	"github.com/riverqueue/river/rivershared/baseservice"
	"riverqueue.com/riverpro"
	prodriver "riverqueue.com/riverpro/driver"
	"riverqueue.com/riverui"
	"riverqueue.com/riverui/internal/apibundle"
	"riverqueue.com/riverui/riverproui/internal/prohandler"
)

type EndpointsOpts[TTx any] struct {
	Client                   *riverpro.Client[TTx]
	JobListHideArgsByDefault bool
	// Tx is an optional transaction to wrap all database operations. It's mainly
	// used for testing.
	Tx *TTx
}

func NewEndpoints[TTx any](opts *EndpointsOpts[TTx]) apibundle.EndpointBundle {
	ossEndpoints := riverui.NewEndpoints(&riverui.EndpointsOpts[TTx]{
		Client:                   opts.Client.Client,
		JobListHideArgsByDefault: opts.JobListHideArgsByDefault,
		Tx:                       opts.Tx,
	})

	return &endpoints[TTx]{
		opts:         opts,
		ossEndpoints: ossEndpoints,
	}
}

type endpoints[TTx any] struct {
	opts         *EndpointsOpts[TTx]
	ossEndpoints apibundle.EndpointBundle
}

func (e *endpoints[TTx]) Validate() error {
	if e.opts.Client == nil {
		return errors.New("client is required")
	}
	if err := e.ossEndpoints.Validate(); err != nil {
		return err
	}
	return nil
}

func (e *endpoints[TTx]) MountEndpoints(archetype *baseservice.Archetype, logger *slog.Logger, mux *http.ServeMux, mountOpts *apiendpoint.MountOpts, extensions map[string]bool) []apiendpoint.EndpointInterface {
	ossDriver := e.opts.Client.Driver()
	driver, ok := ossDriver.(prodriver.ProDriver[TTx])
	if !ok {
		panic("riverpro.Client is not configured with a ProDriver")
	}

	var executor prodriver.ProExecutor
	if e.opts.Tx == nil {
		executor = driver.GetProExecutor()
	} else {
		executor = driver.UnwrapProExecutor(*e.opts.Tx)
	}
	bundle := prohandler.ProAPIBundle[TTx]{
		APIBundle: apibundle.APIBundle[TTx]{
			Archetype:                archetype,
			Client:                   e.opts.Client.Client,
			DB:                       executor,
			Driver:                   driver,
			JobListHideArgsByDefault: e.opts.JobListHideArgsByDefault,
			Logger:                   logger,
		},
		Client: e.opts.Client,
		DB:     executor,
	}

	endpoints := e.ossEndpoints.MountEndpoints(archetype, logger, mux, mountOpts, extensions)
	endpoints = append(endpoints,
		apiendpoint.Mount(mux, prohandler.NewProducerListEndpoint(bundle), mountOpts),
		apiendpoint.Mount(mux, prohandler.NewWorkflowGetEndpoint(bundle), mountOpts),
		apiendpoint.Mount(mux, prohandler.NewWorkflowListEndpoint(bundle), mountOpts),
	)

	return endpoints
}

func (e *endpoints[TTx]) Extensions() map[string]bool {
	return map[string]bool{
		"producer_queries": true,
		"workflow_queries": true,
	}
}
