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
	"riverqueue.com/riverui/uiendpoints"
)

type EndpointsOpts[TTx any] struct {
	// Tx is an optional transaction to wrap all database operations. It's mainly
	// used for testing.
	Tx *TTx
}

func NewEndpoints[TTx any](client *riverpro.Client[TTx], opts *EndpointsOpts[TTx]) uiendpoints.Bundle {
	if opts == nil {
		opts = &EndpointsOpts[TTx]{}
	}
	ossEndpoints := riverui.NewEndpoints(client.Client, &riverui.EndpointsOpts[TTx]{
		Tx: opts.Tx,
	})

	return &endpoints[TTx]{
		client:       client,
		proOpts:      opts,
		ossEndpoints: ossEndpoints,
	}
}

type endpoints[TTx any] struct {
	bundleOpts   *uiendpoints.BundleOpts
	client       *riverpro.Client[TTx]
	proOpts      *EndpointsOpts[TTx]
	ossEndpoints uiendpoints.Bundle
}

func (e *endpoints[TTx]) Configure(bundleOpts *uiendpoints.BundleOpts) {
	e.bundleOpts = bundleOpts
	e.ossEndpoints.Configure(bundleOpts)
}

func (e *endpoints[TTx]) Validate() error {
	if e.client == nil {
		return errors.New("client is required")
	}
	if err := e.ossEndpoints.Validate(); err != nil {
		return err
	}
	return nil
}

func (e *endpoints[TTx]) MountEndpoints(archetype *baseservice.Archetype, logger *slog.Logger, mux *http.ServeMux, mountOpts *apiendpoint.MountOpts, extensions map[string]bool) []apiendpoint.EndpointInterface {
	ossDriver := e.client.Driver()
	driver, ok := ossDriver.(prodriver.ProDriver[TTx])
	if !ok {
		panic("riverpro.Client is not configured with a ProDriver")
	}

	var executor prodriver.ProExecutor
	if e.proOpts.Tx == nil {
		executor = driver.GetProExecutor()
	} else {
		executor = driver.UnwrapProExecutor(*e.proOpts.Tx)
	}
	bundle := prohandler.ProAPIBundle[TTx]{
		APIBundle: apibundle.APIBundle[TTx]{
			Archetype:                archetype,
			Client:                   e.client.Client,
			DB:                       executor,
			Driver:                   driver,
			JobListHideArgsByDefault: e.bundleOpts.JobListHideArgsByDefault,
			Logger:                   logger,
		},
		Client: e.client,
		DB:     executor,
	}

	endpoints := e.ossEndpoints.MountEndpoints(archetype, logger, mux, mountOpts, extensions)
	endpoints = append(endpoints,
		apiendpoint.Mount(mux, prohandler.NewProducerListEndpoint(bundle), mountOpts),
		apiendpoint.Mount(mux, prohandler.NewWorkflowCancelEndpoint(bundle), mountOpts),
		apiendpoint.Mount(mux, prohandler.NewWorkflowGetEndpoint(bundle), mountOpts),
		apiendpoint.Mount(mux, prohandler.NewWorkflowListEndpoint(bundle), mountOpts),
		apiendpoint.Mount(mux, prohandler.NewWorkflowRetryEndpoint(bundle), mountOpts),
	)

	return endpoints
}

func (e *endpoints[TTx]) Extensions() map[string]bool {
	return map[string]bool{
		"producer_queries": true,
		"workflow_queries": true,
	}
}
