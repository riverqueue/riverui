package riverui

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/require"

	"github.com/riverqueue/apiframe/apiendpoint"
	"github.com/riverqueue/apiframe/apierror"
	"github.com/riverqueue/apiframe/apitest"
	"github.com/riverqueue/apiframe/apitype"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdbtest"
	"github.com/riverqueue/river/riverdriver"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
	"github.com/riverqueue/river/rivershared/riversharedtest"
	"github.com/riverqueue/river/rivershared/startstop"
	"github.com/riverqueue/river/rivershared/uniquestates"
	"github.com/riverqueue/river/rivershared/util/ptrutil"
	"github.com/riverqueue/river/rivertype"

	"riverqueue.com/riverui/internal/apibundle"
	"riverqueue.com/riverui/internal/riverinternaltest/testfactory"
	"riverqueue.com/riverui/internal/uicommontest"
)

type setupEndpointTestBundle struct {
	client *river.Client[pgx.Tx]
	exec   riverdriver.ExecutorTx
	logger *slog.Logger
	tx     pgx.Tx
}

func setupEndpoint[TEndpoint any](ctx context.Context, t *testing.T, initFunc func(bundle apibundle.APIBundle[pgx.Tx]) *TEndpoint) (*TEndpoint, *setupEndpointTestBundle) {
	t.Helper()
	return setupEndpointWithOpts(ctx, t, initFunc, nil)
}

func setupEndpointWithOpts[TEndpoint any](ctx context.Context, t *testing.T, initFunc func(bundle apibundle.APIBundle[pgx.Tx]) *TEndpoint, opts *riverdbtest.TestTxOpts) (*TEndpoint, *setupEndpointTestBundle) {
	t.Helper()

	var (
		logger = riversharedtest.Logger(t)
		driver = riverpgxv5.New(riversharedtest.DBPool(ctx, t))
		tx, _  = riverdbtest.TestTxPgxDriver(ctx, t, driver, opts)
		exec   = driver.UnwrapExecutor(tx)
	)

	client, err := river.NewClient(driver, &river.Config{
		Logger: logger,
	})
	require.NoError(t, err)

	endpoint := initFunc(apibundle.APIBundle[pgx.Tx]{
		Archetype:  riversharedtest.BaseServiceArchetype(t),
		Client:     client,
		DB:         exec,
		Driver:     driver,
		Extensions: func(_ context.Context) (map[string]bool, error) { return map[string]bool{}, nil },
		Logger:     logger,
	})

	if service, ok := any(endpoint).(startstop.Service); ok {
		require.NoError(t, service.Start(ctx))
		t.Cleanup(service.Stop)
	}

	return endpoint, &setupEndpointTestBundle{
		client: client,
		exec:   exec,
		logger: logger,
		tx:     tx,
	}
}

func setupEndpointWithCustomSchema[TEndpoint any](ctx context.Context, t *testing.T, initFunc func(bundle apibundle.APIBundle[pgx.Tx]) *TEndpoint) (*TEndpoint, *setupEndpointTestBundle) {
	t.Helper()

	var (
		logger = riversharedtest.Logger(t)
		driver = riverpgxv5.New(riversharedtest.DBPool(ctx, t))
		schema = riverdbtest.TestSchema(ctx, t, driver, nil)
	)

	exec, err := driver.GetExecutor().Begin(ctx)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, exec.Rollback(ctx)) })
	require.NoError(t, exec.Exec(ctx, "SET LOCAL search_path TO public"))

	client, err := river.NewClient(driver, &river.Config{
		Logger: logger,
		Schema: schema,
	})
	require.NoError(t, err)

	endpoint := initFunc(apibundle.APIBundle[pgx.Tx]{
		Archetype:  riversharedtest.BaseServiceArchetype(t),
		Client:     client,
		DB:         exec,
		Driver:     driver,
		Extensions: func(_ context.Context) (map[string]bool, error) { return map[string]bool{}, nil },
		Logger:     logger,
	})

	if service, ok := any(endpoint).(startstop.Service); ok {
		require.NoError(t, service.Start(ctx))
		t.Cleanup(service.Stop)
	}

	return endpoint, &setupEndpointTestBundle{
		client: client,
		exec:   exec,
		logger: logger,
		tx:     driver.UnwrapTx(exec),
	}
}

func testMountOpts(t *testing.T) *apiendpoint.MountOpts {
	t.Helper()
	return &apiendpoint.MountOpts{
		Logger:    riversharedtest.Logger(t),
		Validator: apitype.NewValidator(),
	}
}

func runAutocompleteTests(t *testing.T, facet autocompleteFacet, setupFunc func(t *testing.T, bundle *setupEndpointTestBundle)) {
	t.Helper()

	ctx := context.Background()
	alphaPrefix := "alpha"

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newAutocompleteListEndpoint)
		setupFunc(t, bundle)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &autocompleteListRequest{
			Facet: facet,
		})
		require.NoError(t, err)
		require.Len(t, resp.Data, 4)
		require.Equal(t, "alpha_"+facet.baseString(), *resp.Data[0])
		require.Equal(t, "alpha_task", *resp.Data[1])
		require.Equal(t, "beta_"+facet.baseString(), *resp.Data[2])
		require.Equal(t, "gamma_"+facet.baseString(), *resp.Data[3])
	})

	t.Run("WithPrefix", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newAutocompleteListEndpoint)
		setupFunc(t, bundle)

		prefix := alphaPrefix
		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &autocompleteListRequest{
			Facet: facet,
			Match: &prefix,
		})
		require.NoError(t, err)
		require.Len(t, resp.Data, 2)
		require.Equal(t, "alpha_"+facet.baseString(), *resp.Data[0])
		require.Equal(t, "alpha_task", *resp.Data[1])
	})

	t.Run("WithAfter", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newAutocompleteListEndpoint)
		setupFunc(t, bundle)

		after := "alpha_" + facet.baseString()
		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &autocompleteListRequest{
			After: &after,
			Facet: facet,
		})
		require.NoError(t, err)
		require.Len(t, resp.Data, 3)
		require.Equal(t, "alpha_task", *resp.Data[0])
		require.Equal(t, "beta_"+facet.baseString(), *resp.Data[1])
		require.Equal(t, "gamma_"+facet.baseString(), *resp.Data[2])
	})

	t.Run("WithExclude", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newAutocompleteListEndpoint)
		setupFunc(t, bundle)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &autocompleteListRequest{
			Exclude: []string{"alpha_" + facet.baseString(), "beta_" + facet.baseString()},
			Facet:   facet,
		})
		require.NoError(t, err)
		require.Len(t, resp.Data, 2)
		require.Equal(t, "alpha_task", *resp.Data[0])
		require.Equal(t, "gamma_"+facet.baseString(), *resp.Data[1])
	})

	t.Run("WithPrefixAndExclude", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newAutocompleteListEndpoint)
		setupFunc(t, bundle)

		prefix := alphaPrefix
		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &autocompleteListRequest{
			Exclude: []string{"alpha_" + facet.baseString()},
			Facet:   facet,
			Match:   &prefix,
		})
		require.NoError(t, err)
		require.Len(t, resp.Data, 1)
		require.Equal(t, "alpha_task", *resp.Data[0])
	})
}

func (f autocompleteFacet) baseString() string {
	switch f {
	case autocompleteFacetJobKind:
		return "job"
	case autocompleteFacetQueueName:
		return "queue"
	default:
		return ""
	}
}

func TestAPIHandlerAutocompleteList(t *testing.T) {
	t.Parallel()

	t.Run("JobKind", func(t *testing.T) {
		t.Parallel()

		setupTestKinds := func(t *testing.T, bundle *setupEndpointTestBundle) {
			t.Helper()
			ctx := context.Background()
			testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{Kind: ptrutil.Ptr("alpha_job")})
			testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{Kind: ptrutil.Ptr("alpha_task")})
			testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{Kind: ptrutil.Ptr("beta_job")})
			testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{Kind: ptrutil.Ptr("gamma_job")})
		}

		runAutocompleteTests(t, autocompleteFacetJobKind, setupTestKinds)
	})

	t.Run("QueueName", func(t *testing.T) {
		t.Parallel()

		setupTestQueues := func(t *testing.T, bundle *setupEndpointTestBundle) {
			t.Helper()
			ctx := context.Background()
			testfactory.Queue(ctx, t, bundle.exec, &testfactory.QueueOpts{Name: ptrutil.Ptr("alpha_queue")})
			testfactory.Queue(ctx, t, bundle.exec, &testfactory.QueueOpts{Name: ptrutil.Ptr("alpha_task")})
			testfactory.Queue(ctx, t, bundle.exec, &testfactory.QueueOpts{Name: ptrutil.Ptr("beta_queue")})
			testfactory.Queue(ctx, t, bundle.exec, &testfactory.QueueOpts{Name: ptrutil.Ptr("gamma_queue")})
		}

		runAutocompleteTests(t, autocompleteFacetQueueName, setupTestQueues)
	})

	t.Run("InvalidFacet", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()

		endpoint, _ := setupEndpoint(ctx, t, newAutocompleteListEndpoint)

		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &autocompleteListRequest{
			Facet: "invalid",
		})
		uicommontest.RequireAPIError(t, apierror.NewBadRequestf("Invalid facet %q. Valid facets are: job_kind, queue_name", "invalid"), err)
	})
}

func TestAPIHandlerAutocompleteListCustomSchema(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	endpoint, bundle := setupEndpointWithCustomSchema(ctx, t, newAutocompleteListEndpoint)
	schema := bundle.client.Schema()

	jobParams := testfactory.Job_Build(t, &testfactory.JobOpts{Kind: ptrutil.Ptr("custom_schema_job")})
	jobParams.Schema = schema
	_, err := bundle.exec.JobInsertFull(ctx, jobParams)
	require.NoError(t, err)

	_, err = bundle.exec.QueueCreateOrSetUpdatedAt(ctx, &riverdriver.QueueCreateOrSetUpdatedAtParams{
		Metadata: []byte("{}"),
		Name:     "custom_schema_queue",
		Schema:   schema,
	})
	require.NoError(t, err)

	jobKindResp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &autocompleteListRequest{
		Facet: autocompleteFacetJobKind,
		Match: ptrutil.Ptr("custom_schema_job"),
	})
	require.NoError(t, err)
	require.Len(t, jobKindResp.Data, 1)
	require.Equal(t, "custom_schema_job", *jobKindResp.Data[0])

	queueNameResp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &autocompleteListRequest{
		Facet: autocompleteFacetQueueName,
		Match: ptrutil.Ptr("custom_schema_queue"),
	})
	require.NoError(t, err)
	require.Len(t, queueNameResp.Data, 1)
	require.Equal(t, "custom_schema_queue", *queueNameResp.Data[0])
}

func TestAPIHandlerFeaturesGet(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("SuccessWithEverythingFalse", func(t *testing.T) {
		t.Parallel()

		// DisableSchemaSharing is required because we're making DB schema changes.
		endpoint, bundle := setupEndpointWithOpts(ctx, t, newFeaturesGetEndpoint, &riverdbtest.TestTxOpts{DisableSchemaSharing: true})

		_, err := bundle.tx.Exec(ctx, `DROP TABLE IF EXISTS river_job_sequence;`)
		require.NoError(t, err)
		_, err = bundle.tx.Exec(ctx, `DROP TABLE IF EXISTS river_producer;`)
		require.NoError(t, err)
		_, err = bundle.tx.Exec(ctx, `DROP INDEX IF EXISTS river_job_workflow_list_active;`)
		require.NoError(t, err)
		_, err = bundle.tx.Exec(ctx, `DROP INDEX IF EXISTS river_job_workflow_scheduling;`)
		require.NoError(t, err)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &featuresGetRequest{})
		require.NoError(t, err)
		require.Equal(t, &featuresGetResponse{
			Extensions:               map[string]bool{},
			JobListHideArgsByDefault: false,
		}, resp)
	})

	t.Run("SuccessWithEverythingTrue", func(t *testing.T) {
		t.Parallel()

		// DisableSchemaSharing is required because we're making DB schema changes.
		endpoint, bundle := setupEndpointWithOpts(ctx, t, newFeaturesGetEndpoint, &riverdbtest.TestTxOpts{DisableSchemaSharing: true})

		_, err := bundle.tx.Exec(ctx, `CREATE TABLE IF NOT EXISTS river_job_sequence (id SERIAL PRIMARY KEY);`)
		require.NoError(t, err)
		_, err = bundle.tx.Exec(ctx, `CREATE TABLE IF NOT EXISTS river_producer (id SERIAL PRIMARY KEY);`)
		require.NoError(t, err)
		_, err = bundle.tx.Exec(ctx, `CREATE INDEX IF NOT EXISTS river_job_workflow_list_active ON river_job ((metadata->>'workflow_id'));`)
		require.NoError(t, err)
		_, err = bundle.tx.Exec(ctx, `CREATE INDEX IF NOT EXISTS river_job_workflow_list_active ON river_job ((metadata->>'workflow_id'));`)
		require.NoError(t, err)

		endpoint.JobListHideArgsByDefault = true

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &featuresGetRequest{})
		require.NoError(t, err)
		require.Equal(t, &featuresGetResponse{
			Extensions:               map[string]bool{},
			JobListHideArgsByDefault: true,
		}, resp)
	})

	t.Run("SuccessWithExtensions", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint(ctx, t, newFeaturesGetEndpoint)
		endpoint.Extensions = func(_ context.Context) (map[string]bool, error) {
			return map[string]bool{
				"test_1": true,
				"test_2": false,
			}, nil
		}

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &featuresGetRequest{})
		require.NoError(t, err)
		require.Equal(t, map[string]bool{"test_1": true, "test_2": false}, resp.Extensions)
	})
}

func TestAPIHandlerHealthCheckGet(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("CompleteSuccess", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint(ctx, t, newHealthCheckGetEndpoint)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &healthCheckGetRequest{Name: healthCheckNameComplete})
		require.NoError(t, err)
		require.Equal(t, statusResponseOK, resp)
	})

	t.Run("CompleteDatabaseError", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newHealthCheckGetEndpoint)

		// Roll back prematurely so we get a database error.
		require.NoError(t, bundle.tx.Rollback(ctx))

		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &healthCheckGetRequest{Name: healthCheckNameComplete})
		uicommontest.RequireAPIError(t, apierror.WithInternalError(
			apierror.NewServiceUnavailable("Unable to query database. Check logs for details."),
			pgx.ErrTxClosed,
		), err)
	})

	t.Run("Minimal", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint(ctx, t, newHealthCheckGetEndpoint)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &healthCheckGetRequest{Name: healthCheckNameMinimal})
		require.NoError(t, err)
		require.Equal(t, statusResponseOK, resp)
	})

	t.Run("NotFound", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint(ctx, t, newHealthCheckGetEndpoint)

		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &healthCheckGetRequest{Name: "other"})
		uicommontest.RequireAPIError(t, apierror.NewNotFoundf("Health check %q not found. Use either `complete` or `minimal`.", "other"), err)
	})
}

func TestAPIHandlerJobCancel(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newJobCancelEndpoint)

		job1 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{})
		job2 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobCancelRequest{JobIDs: []int64String{int64String(job1.ID), int64String(job2.ID)}})
		require.NoError(t, err)
		require.Equal(t, statusResponseOK, resp)

		updatedJob1, err := bundle.client.JobGetTx(ctx, bundle.tx, job1.ID)
		require.NoError(t, err)
		require.Equal(t, rivertype.JobStateCancelled, updatedJob1.State)

		updatedJob2, err := bundle.client.JobGetTx(ctx, bundle.tx, job2.ID)
		require.NoError(t, err)
		require.Equal(t, rivertype.JobStateCancelled, updatedJob2.State)
	})

	t.Run("NotFound", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint(ctx, t, newJobCancelEndpoint)

		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobCancelRequest{JobIDs: []int64String{123}})
		uicommontest.RequireAPIError(t, NewNotFoundJob(123), err)
	})
}

func TestAPIHandlerJobDelete(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newJobDeleteEndpoint)

		job1 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{})
		job2 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobDeleteRequest{JobIDs: []int64String{int64String(job1.ID), int64String(job2.ID)}})
		require.NoError(t, err)
		require.Equal(t, statusResponseOK, resp)

		_, err = bundle.client.JobGetTx(ctx, bundle.tx, job1.ID)
		require.ErrorIs(t, err, rivertype.ErrNotFound)

		_, err = bundle.client.JobGetTx(ctx, bundle.tx, job2.ID)
		require.ErrorIs(t, err, rivertype.ErrNotFound)
	})

	t.Run("NotFound", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint(ctx, t, newJobDeleteEndpoint)

		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobDeleteRequest{JobIDs: []int64String{123}})
		uicommontest.RequireAPIError(t, NewNotFoundJob(123), err)
	})
}

func TestAPIHandlerJobGet(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newJobGetEndpoint)

		encodedArgs := []byte(`{"id":1970670598291982290,"max":9223372036854775807}`)
		job := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			EncodedArgs: encodedArgs,
		})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobGetRequest{JobID: job.ID})
		require.NoError(t, err)
		require.Equal(t, job.ID, resp.ID)
		expectedArgs := string(job.EncodedArgs)
		require.Equal(t, expectedArgs, resp.Args)
		require.Contains(t, resp.Args, "1970670598291982290")
		require.Contains(t, resp.Args, "9223372036854775807")

		var wireResp struct {
			Args string `json:"args"`
		}
		require.NoError(t, json.Unmarshal(uicommontest.MustMarshalJSON(t, resp), &wireResp))
		require.Equal(t, expectedArgs, wireResp.Args)
		require.True(t, json.Valid([]byte(wireResp.Args)))
	})

	t.Run("NotFound", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint(ctx, t, newJobGetEndpoint)

		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobGetRequest{JobID: 123})
		uicommontest.RequireAPIError(t, NewNotFoundJob(123), err)
	})
}

func TestAPIHandlerJobList(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newJobListEndpoint)

		job1 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			EncodedArgs: []byte(`{"id":1970670598291982290}`),
			Kind:        ptrutil.Ptr("kind1"),
			Queue:       ptrutil.Ptr("queue1"),
			State:       ptrutil.Ptr(rivertype.JobStateRunning),
		})
		job2 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			Kind:  ptrutil.Ptr("kind2"),
			Queue: ptrutil.Ptr("queue2"),
			State: ptrutil.Ptr(rivertype.JobStateRunning),
		})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobListRequest{})
		require.NoError(t, err)
		require.Len(t, resp.Data, 2)
		require.Equal(t, job1.ID, resp.Data[0].ID)
		expectedArgs := string(job1.EncodedArgs)
		require.Equal(t, expectedArgs, resp.Data[0].Args)
		require.Contains(t, resp.Data[0].Args, "1970670598291982290")
		require.Equal(t, job2.ID, resp.Data[1].ID)

		var wireResp struct {
			Data []struct {
				Args string `json:"args"`
			} `json:"data"`
		}
		require.NoError(t, json.Unmarshal(uicommontest.MustMarshalJSON(t, resp), &wireResp))
		require.Equal(t, expectedArgs, wireResp.Data[0].Args)
	})

	t.Run("FilterByIDs", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newJobListEndpoint)

		job1 := testfactory.Job(ctx, t, bundle.exec, nil)
		job2 := testfactory.Job(ctx, t, bundle.exec, nil)
		_ = testfactory.Job(ctx, t, bundle.exec, nil)
		_ = testfactory.Job(ctx, t, bundle.exec, nil)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobListRequest{
			IDs:   []int64{job1.ID, job2.ID},
			State: ptrutil.Ptr(rivertype.JobStateAvailable),
		})
		require.NoError(t, err)
		require.Len(t, resp.Data, 2)
		require.Equal(t, job1.ID, resp.Data[0].ID)
		require.Equal(t, job2.ID, resp.Data[1].ID)
	})

	t.Run("FilterByKind", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newJobListEndpoint)

		job := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			Kind:  ptrutil.Ptr("kind1"),
			State: ptrutil.Ptr(rivertype.JobStateRunning),
		})
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			Kind:  ptrutil.Ptr("kind2"),
			State: ptrutil.Ptr(rivertype.JobStateRunning),
		})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobListRequest{
			Kinds: []string{"kind1"},
		})
		require.NoError(t, err)
		require.Len(t, resp.Data, 1)
		require.Equal(t, job.ID, resp.Data[0].ID)
	})

	t.Run("FilterByPriority", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newJobListEndpoint)

		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			Priority: ptrutil.Ptr(1),
		})
		job2 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			Priority: ptrutil.Ptr(2),
		})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobListRequest{
			Priorities: []int16{2},
			State:      ptrutil.Ptr(rivertype.JobStateAvailable),
		})
		require.NoError(t, err)
		require.Len(t, resp.Data, 1)
		require.Equal(t, job2.ID, resp.Data[0].ID)
	})

	t.Run("FilterByQueue", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newJobListEndpoint)

		job := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			Queue: ptrutil.Ptr("queue1"),
			State: ptrutil.Ptr(rivertype.JobStateRunning),
		})
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			Queue: ptrutil.Ptr("queue2"),
			State: ptrutil.Ptr(rivertype.JobStateRunning),
		})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobListRequest{
			Queues: []string{"queue1"},
		})
		require.NoError(t, err)
		require.Len(t, resp.Data, 1)
		require.Equal(t, job.ID, resp.Data[0].ID)
	})

	t.Run("FilterByTags", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newJobListEndpoint)

		job1 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			State: ptrutil.Ptr(rivertype.JobStateRunning),
			Tags:  []string{"alpha-tag", "shared"},
		})
		job2 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			State: ptrutil.Ptr(rivertype.JobStateRunning),
			Tags:  []string{"beta"},
		})
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			State: ptrutil.Ptr(rivertype.JobStateRunning),
			Tags:  []string{"ALPHA-TAG"},
		})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobListRequest{
			Tags: []string{"alpha-tag", "beta"},
		})
		require.NoError(t, err)
		require.Len(t, resp.Data, 2)
		require.Equal(t, job1.ID, resp.Data[0].ID)
		require.Equal(t, job2.ID, resp.Data[1].ID)
	})

	t.Run("FilterByState", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newJobListEndpoint)

		job := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			State: ptrutil.Ptr(rivertype.JobStateAvailable),
		})
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			State: ptrutil.Ptr(rivertype.JobStateRunning),
		})

		state := rivertype.JobStateAvailable
		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobListRequest{
			State: &state,
		})
		require.NoError(t, err)
		require.Len(t, resp.Data, 1)
		require.Equal(t, job.ID, resp.Data[0].ID)
	})

	t.Run("Limit", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newJobListEndpoint)

		job := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			State: ptrutil.Ptr(rivertype.JobStateRunning),
		})
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			State: ptrutil.Ptr(rivertype.JobStateRunning),
		})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobListRequest{
			Limit: ptrutil.Ptr(1),
		})
		require.NoError(t, err)
		require.Len(t, resp.Data, 1)
		require.Equal(t, job.ID, resp.Data[0].ID)
	})
}

func TestAPIHandlerJobListCustomSchema(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	endpoint, bundle := setupEndpointWithCustomSchema(ctx, t, newJobListEndpoint)
	jobParams := testfactory.Job_Build(t, &testfactory.JobOpts{
		State: ptrutil.Ptr(rivertype.JobStateRunning),
		Tags:  []string{"custom-schema-tag"},
	})
	jobParams.Schema = bundle.client.Schema()
	job, err := bundle.exec.JobInsertFull(ctx, jobParams)
	require.NoError(t, err)

	resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobListRequest{
		Tags: []string{"custom-schema-tag"},
	})
	require.NoError(t, err)
	require.Len(t, resp.Data, 1)
	require.Equal(t, job.ID, resp.Data[0].ID)
}

func TestJobListRequestExtractRaw(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequestWithContext(
		t.Context(),
		http.MethodGet,
		"/api/jobs?tags=ALPHA&tags=customer%3A123",
		nil,
	)
	params := &jobListRequest{}

	require.NoError(t, params.ExtractRaw(req))
	require.Equal(t, []string{"ALPHA", "customer:123"}, params.Tags)
}

func TestAPIHandlerJobRetry(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newJobRetryEndpoint)

		job1 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			FinalizedAt: ptrutil.Ptr(time.Now()),
			State:       ptrutil.Ptr(rivertype.JobStateDiscarded),
		})
		job2 := testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{
			FinalizedAt: ptrutil.Ptr(time.Now()),
			State:       ptrutil.Ptr(rivertype.JobStateDiscarded),
		})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobRetryRequest{JobIDs: []int64String{int64String(job1.ID), int64String(job2.ID)}})
		require.NoError(t, err)
		require.Equal(t, statusResponseOK, resp)

		updatedJob1, err := bundle.client.JobGetTx(ctx, bundle.tx, job1.ID)
		require.NoError(t, err)
		require.Equal(t, rivertype.JobStateAvailable, updatedJob1.State)

		updatedJob2, err := bundle.client.JobGetTx(ctx, bundle.tx, job2.ID)
		require.NoError(t, err)
		require.Equal(t, rivertype.JobStateAvailable, updatedJob2.State)
	})

	t.Run("NotFound", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint(ctx, t, newJobRetryEndpoint)

		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobRetryRequest{JobIDs: []int64String{123}})
		uicommontest.RequireAPIError(t, NewNotFoundJob(123), err)
	})

	t.Run("UniqueConflict", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newJobRetryEndpoint)
		uniqueKey := []byte("job-retry-unique-conflict")
		uniqueStates := uniquestates.UniqueStatesToBitmask([]rivertype.JobState{rivertype.JobStateAvailable})

		discardedParams := testfactory.Job_Build(t, &testfactory.JobOpts{
			FinalizedAt: ptrutil.Ptr(time.Now()),
			State:       ptrutil.Ptr(rivertype.JobStateDiscarded),
		})
		discardedParams.UniqueKey = uniqueKey
		discardedParams.UniqueStates = uniqueStates
		discardedJob, err := bundle.exec.JobInsertFull(ctx, discardedParams)
		require.NoError(t, err)

		activeParams := testfactory.Job_Build(t, nil)
		activeParams.UniqueKey = uniqueKey
		activeParams.UniqueStates = uniqueStates
		_, err = bundle.exec.JobInsertFull(ctx, activeParams)
		require.NoError(t, err)

		_, err = apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &jobRetryRequest{JobIDs: []int64String{int64String(discardedJob.ID)}})
		require.Error(t, err)

		var apiErr *jobRetryUniqueConflictError
		require.ErrorAs(t, err, &apiErr)
		require.Equal(t, http.StatusConflict, apiErr.StatusCode)
		require.Equal(t, jobRetryUniqueMessage, apiErr.Message)
		require.Error(t, apiErr.InternalError)
	})
}

func TestAPIHandlerQueueGet(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newQueueGetEndpoint)

		queue := testfactory.Queue(ctx, t, bundle.exec, nil)

		_, err := bundle.client.InsertTx(ctx, bundle.tx, &uicommontest.NoOpArgs{}, &river.InsertOpts{Queue: queue.Name})
		require.NoError(t, err)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &queueGetRequest{Name: queue.Name})
		require.NoError(t, err)
		require.Equal(t, 1, resp.CountAvailable)
		require.Equal(t, queue.Name, resp.Name)
	})

	t.Run("NotFound", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint(ctx, t, newQueueGetEndpoint)

		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &queueGetRequest{Name: "does_not_exist"})
		uicommontest.RequireAPIError(t, NewNotFoundQueue("does_not_exist"), err)
	})
}

func TestAPIHandlerQueueList(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newQueueListEndpoint)

		queue1 := testfactory.Queue(ctx, t, bundle.exec, nil)
		queue2 := testfactory.Queue(ctx, t, bundle.exec, nil)

		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{Queue: &queue1.Name})
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{Queue: &queue2.Name})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &queueListRequest{})
		require.NoError(t, err)
		require.Len(t, resp.Data, 2)
		require.Equal(t, 1, resp.Data[0].CountAvailable)
		require.Equal(t, queue1.Name, resp.Data[0].Name)
		require.Equal(t, 1, resp.Data[1].CountAvailable)
		require.Equal(t, queue2.Name, resp.Data[1].Name)
	})

	t.Run("Limit", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newQueueListEndpoint)

		queue1 := testfactory.Queue(ctx, t, bundle.exec, nil)
		_ = testfactory.Queue(ctx, t, bundle.exec, nil)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &queueListRequest{Limit: ptrutil.Ptr(1)})
		require.NoError(t, err)
		require.Len(t, resp.Data, 1)
		require.Equal(t, queue1.Name, resp.Data[0].Name)
	})
}

func TestAPIHandlerQueuePause(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newQueuePauseEndpoint)

		queue := testfactory.Queue(ctx, t, bundle.exec, nil)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &queuePauseRequest{Name: queue.Name})
		require.NoError(t, err)
		require.Equal(t, statusResponseOK, resp)
	})

	t.Run("NotFound", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint(ctx, t, newQueuePauseEndpoint)

		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &queuePauseRequest{Name: "does_not_exist"})
		uicommontest.RequireAPIError(t, NewNotFoundQueue("does_not_exist"), err)
	})
}

func TestAPIHandlerQueueResume(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newQueueResumeEndpoint)

		queue := testfactory.Queue(ctx, t, bundle.exec, &testfactory.QueueOpts{
			PausedAt: ptrutil.Ptr(time.Now()),
		})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &queueResumeRequest{Name: queue.Name})
		require.NoError(t, err)
		require.Equal(t, statusResponseOK, resp)
	})

	t.Run("NotFound", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint(ctx, t, newQueueResumeEndpoint)

		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &queueResumeRequest{Name: "does_not_exist"})
		uicommontest.RequireAPIError(t, NewNotFoundQueue("does_not_exist"), err)
	})
}

func TestAPIHandlerQueueUpdate(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newQueueUpdateEndpoint)

		queue := testfactory.Queue(ctx, t, bundle.exec, nil)

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &queueUpdateRequest{
			Name: queue.Name,
			Concurrency: apitype.ExplicitNullable[ConcurrencyConfig]{
				Set:   true,
				Value: &ConcurrencyConfig{GlobalLimit: 10, LocalLimit: 5},
			},
		})
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, queue.Name, resp.Name)
		require.Equal(t, &ConcurrencyConfig{
			GlobalLimit: 10,
			LocalLimit:  5,
		}, resp.Concurrency)
	})

	t.Run("SortsPartitionByArgs", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newQueueUpdateEndpoint)

		queue := testfactory.Queue(ctx, t, bundle.exec, nil)

		// Create unsorted ByArgs array
		unsortedArgs := []string{"z", "c", "a", "b"}
		sortedArgs := []string{"a", "b", "c", "z"} // same array but sorted

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &queueUpdateRequest{
			Name: queue.Name,
			Concurrency: apitype.ExplicitNullable[ConcurrencyConfig]{
				Set: true,
				Value: &ConcurrencyConfig{
					GlobalLimit: 10,
					LocalLimit:  5,
					Partition: PartitionConfig{
						ByArgs: unsortedArgs,
						ByKind: true,
					},
				},
			},
		})
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, queue.Name, resp.Name)
		require.NotNil(t, resp.Concurrency)
		require.Equal(t, sortedArgs, resp.Concurrency.Partition.ByArgs)
	})

	t.Run("NotFound", func(t *testing.T) {
		t.Parallel()

		endpoint, _ := setupEndpoint(ctx, t, newQueueUpdateEndpoint)

		_, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &queueUpdateRequest{
			Name: "does_not_exist",
		})
		uicommontest.RequireAPIError(t, NewNotFoundQueue("does_not_exist"), err)
	})
}

func TestStateAndCountGetEndpoint(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	stateCountsFromResponse := func(resp *stateAndCountGetResponse) map[rivertype.JobState]*stateCountResponse {
		return map[rivertype.JobState]*stateCountResponse{
			rivertype.JobStateAvailable: &resp.Available,
			rivertype.JobStateCancelled: &resp.Cancelled,
			rivertype.JobStateCompleted: &resp.Completed,
			rivertype.JobStateDiscarded: &resp.Discarded,
			rivertype.JobStatePending:   &resp.Pending,
			rivertype.JobStateRetryable: &resp.Retryable,
			rivertype.JobStateRunning:   &resp.Running,
			rivertype.JobStateScheduled: &resp.Scheduled,
		}
	}
	requireExactCounts := func(t *testing.T, resp *stateAndCountGetResponse) {
		t.Helper()
		for state, stateCount := range stateCountsFromResponse(resp) {
			require.Equal(t, stateCountAccuracyExact, stateCount.Accuracy, state)
			require.NotNil(t, stateCount.ObservedAt, state)
		}
	}

	t.Run("Success", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newStateAndCountGetEndpoint)

		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateAvailable)})

		for range 2 {
			_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateCancelled), FinalizedAt: ptrutil.Ptr(time.Now())})
		}

		for range 3 {
			_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateCompleted), FinalizedAt: ptrutil.Ptr(time.Now())})
		}

		for range 4 {
			_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateDiscarded), FinalizedAt: ptrutil.Ptr(time.Now())})
		}

		for range 5 {
			_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStatePending)})
		}

		for range 6 {
			_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateRetryable)})
		}

		for range 7 {
			_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateRunning)})
		}

		for range 8 {
			_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateScheduled)})
		}

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &stateAndCountGetRequest{})
		require.NoError(t, err)
		requireExactCounts(t, resp)
		require.Equal(t, 1, resp.Available.Count)
		require.Equal(t, 2, resp.Cancelled.Count)
		require.Equal(t, 3, resp.Completed.Count)
		require.Equal(t, 4, resp.Discarded.Count)
		require.Equal(t, 5, resp.Pending.Count)
		require.Equal(t, 6, resp.Retryable.Count)
		require.Equal(t, 7, resp.Running.Count)
		require.Equal(t, 8, resp.Scheduled.Count)
	})

	t.Run("AtCountMaxIsExact", func(t *testing.T) {
		t.Parallel()

		const countMax = 3
		endpoint, bundle := setupEndpoint(ctx, t, func(bundle apibundle.APIBundle[pgx.Tx]) *stateAndCountGetEndpoint[pgx.Tx] {
			endpoint := newStateAndCountGetEndpoint(bundle)
			endpoint.countMax = countMax
			return endpoint
		})

		for range countMax {
			_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateAvailable)})
		}

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &stateAndCountGetRequest{})
		require.NoError(t, err)
		requireExactCounts(t, resp)
		require.Equal(t, countMax, resp.Available.Count)
	})

	t.Run("WithExactCachedSnapshot", func(t *testing.T) {
		t.Parallel()

		const countMax = 3
		endpoint, bundle := setupEndpoint(ctx, t, func(bundle apibundle.APIBundle[pgx.Tx]) *stateAndCountGetEndpoint[pgx.Tx] {
			endpoint := newStateAndCountGetEndpoint(bundle)
			endpoint.countMax = countMax
			return endpoint
		})

		for range countMax + 1 {
			_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateAvailable)})
		}

		_, err := endpoint.boundedQueryCacher.RunQuery(ctx)
		require.NoError(t, err)
		_, err = endpoint.exactQueryCacher.RunQuery(ctx)
		require.NoError(t, err)

		// Once a state is capped, both caches are reused instead of making an
		// exact count part of the request's latency.
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateCancelled), FinalizedAt: ptrutil.Ptr(time.Now())})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &stateAndCountGetRequest{})
		require.NoError(t, err)
		require.Equal(t, countMax+1, resp.Available.Count)
		require.Equal(t, stateCountAccuracyExactCached, resp.Available.Accuracy)
		require.NotNil(t, resp.Available.ObservedAt)
		require.Equal(t, 0, resp.Cancelled.Count)
		require.Equal(t, stateCountAccuracyExact, resp.Cancelled.Accuracy)
	})

	t.Run("WithExactCachedCount", func(t *testing.T) {
		t.Parallel()

		const countMax = 3
		endpoint, bundle := setupEndpoint(ctx, t, func(bundle apibundle.APIBundle[pgx.Tx]) *stateAndCountGetEndpoint[pgx.Tx] {
			endpoint := newStateAndCountGetEndpoint(bundle)
			endpoint.countMax = countMax
			return endpoint
		})

		for range countMax - 1 {
			_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateAvailable)})
		}

		_, err := endpoint.boundedQueryCacher.RunQuery(ctx)
		require.NoError(t, err)

		// An exact cache result is refreshed inline for the latest counts.
		_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateCancelled), FinalizedAt: ptrutil.Ptr(time.Now())})

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &stateAndCountGetRequest{})
		require.NoError(t, err)
		requireExactCounts(t, resp)
		require.Equal(t, countMax-1, resp.Available.Count)
		require.Equal(t, 1, resp.Cancelled.Count)
	})

	t.Run("WithPlannerEstimate", func(t *testing.T) {
		t.Parallel()

		const countMax = 3
		endpoint, bundle := setupEndpoint(ctx, t, func(bundle apibundle.APIBundle[pgx.Tx]) *stateAndCountGetEndpoint[pgx.Tx] {
			endpoint := newStateAndCountGetEndpoint(bundle)
			endpoint.countMax = countMax
			return endpoint
		})

		for range countMax + 1 {
			_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateCompleted), FinalizedAt: ptrutil.Ptr(time.Now())})
		}
		_, err := endpoint.boundedQueryCacher.RunQuery(ctx)
		require.NoError(t, err)

		observedAt := time.Now().Add(-5 * time.Minute)
		endpoint.estimateCounts = func(_ context.Context, states []rivertype.JobState) (map[rivertype.JobState]stateCountEstimate, error) {
			require.Equal(t, []rivertype.JobState{rivertype.JobStateCompleted}, states)
			return map[rivertype.JobState]stateCountEstimate{
				rivertype.JobStateCompleted: {Count: 1_000_000, ObservedAt: &observedAt},
			}, nil
		}

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &stateAndCountGetRequest{})
		require.NoError(t, err)
		require.Equal(t, stateCountResponse{
			Accuracy:   stateCountAccuracyEstimated,
			Count:      1_000_000,
			ObservedAt: &observedAt,
		}, resp.Completed)
	})

	t.Run("ReadsPlannerEstimateFromPostgres", func(t *testing.T) {
		t.Parallel()

		endpoint, bundle := setupEndpoint(ctx, t, newStateAndCountGetEndpoint)
		for range 100 {
			_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateCompleted), FinalizedAt: ptrutil.Ptr(time.Now())})
		}
		for range 10 {
			_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateRunning)})
		}
		require.NoError(t, bundle.exec.Exec(ctx, "ANALYZE river_job"))

		estimates, err := endpoint.queryEstimatedCounts(ctx, []rivertype.JobState{
			rivertype.JobStateCompleted,
			rivertype.JobStateRunning,
		})
		require.NoError(t, err)
		require.Positive(t, estimates[rivertype.JobStateCompleted].Count)
		require.NotNil(t, estimates[rivertype.JobStateCompleted].ObservedAt)
		require.Greater(t, estimates[rivertype.JobStateCompleted].Count, estimates[rivertype.JobStateRunning].Count)
	})

	t.Run("WithLowerBoundForStaleEstimate", func(t *testing.T) {
		t.Parallel()

		const countMax = 3
		endpoint, bundle := setupEndpoint(ctx, t, func(bundle apibundle.APIBundle[pgx.Tx]) *stateAndCountGetEndpoint[pgx.Tx] {
			endpoint := newStateAndCountGetEndpoint(bundle)
			endpoint.countMax = countMax
			return endpoint
		})

		for range countMax + 1 {
			_ = testfactory.Job(ctx, t, bundle.exec, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateAvailable)})
		}
		_, err := endpoint.boundedQueryCacher.RunQuery(ctx)
		require.NoError(t, err)
		endpoint.estimateCounts = func(_ context.Context, _ []rivertype.JobState) (map[rivertype.JobState]stateCountEstimate, error) {
			return map[rivertype.JobState]stateCountEstimate{
				rivertype.JobStateAvailable: {Count: countMax - 1},
			}, nil
		}

		resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &stateAndCountGetRequest{})
		require.NoError(t, err)
		require.Equal(t, countMax, resp.Available.Count)
		require.Equal(t, stateCountAccuracyLowerBound, resp.Available.Accuracy)
		require.NotNil(t, resp.Available.ObservedAt)
	})
}

func TestAllJobStates(t *testing.T) {
	t.Parallel()

	// Keep the endpoint's exhaustive response and SQL allowlist synchronized
	// with River when a job state is added or reordered upstream.
	require.Equal(t, rivertype.JobStates(), allJobStates)
}

func TestStateCountExactRefreshPeriod(t *testing.T) {
	t.Parallel()

	require.Equal(t, stateCountExactRefreshMin, stateCountExactRefreshPeriod(100*time.Millisecond, nil))
	require.Equal(t, 100*time.Second, stateCountExactRefreshPeriod(2*time.Second, nil))
	require.Equal(t, stateCountExactRefreshMax, stateCountExactRefreshPeriod(time.Hour, nil))
	require.Equal(t, stateCountExactRefreshMax, stateCountExactRefreshPeriod(time.Second, errors.New("database busy")))
}

func TestJobStateSQLLiteral(t *testing.T) {
	t.Parallel()

	expected := map[rivertype.JobState]string{
		rivertype.JobStateAvailable: "'available'",
		rivertype.JobStateCancelled: "'cancelled'",
		rivertype.JobStateCompleted: "'completed'",
		rivertype.JobStateDiscarded: "'discarded'",
		rivertype.JobStatePending:   "'pending'",
		rivertype.JobStateRetryable: "'retryable'",
		rivertype.JobStateRunning:   "'running'",
		rivertype.JobStateScheduled: "'scheduled'",
	}
	for state, expectedLiteral := range expected {
		literal, err := jobStateSQLLiteral(state)
		require.NoError(t, err)
		require.Equal(t, expectedLiteral, literal)
	}

	_, err := jobStateSQLLiteral(rivertype.JobState("completed'; DROP TABLE river_job; --"))
	require.EqualError(t, err, `invalid job state for count estimate: "completed'; DROP TABLE river_job; --"`)
}

func TestStateAndCountGetEndpointCustomSchema(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	endpoint, bundle := setupEndpointWithCustomSchema(ctx, t, newStateAndCountGetEndpoint)
	jobParams := testfactory.Job_Build(t, &testfactory.JobOpts{State: ptrutil.Ptr(rivertype.JobStateRunning)})
	jobParams.Schema = bundle.client.Schema()
	_, err := bundle.exec.JobInsertFull(ctx, jobParams)
	require.NoError(t, err)

	resp, err := apitest.InvokeHandler(ctx, endpoint.Execute, testMountOpts(t), &stateAndCountGetRequest{})
	require.NoError(t, err)
	require.Equal(t, 1, resp.Running.Count)
}
