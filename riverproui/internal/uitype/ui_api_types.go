package uitype

import "time"

type ConcurrencyConfig struct {
	GlobalLimit int32           `json:"global_limit"`
	LocalLimit  int32           `json:"local_limit"`
	Partition   PartitionConfig `json:"partition"`
}

type PartitionConfig struct {
	ByArgs []string `json:"by_args"`
	ByKind bool     `json:"by_kind"`
}

type RiverProducer struct {
	ID          int64              `json:"id"`
	ClientID    string             `json:"client_id"`
	Concurrency *ConcurrencyConfig `json:"concurrency"`
	CreatedAt   time.Time          `json:"created_at"`
	MaxWorkers  int                `json:"max_workers"`
	PausedAt    *time.Time         `json:"paused_at"`
	QueueName   string             `json:"queue_name"`
	Running     int32              `json:"running"`
	UpdatedAt   time.Time          `json:"updated_at"`
}
