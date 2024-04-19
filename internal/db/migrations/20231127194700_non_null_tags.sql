-- +goose Up
ALTER TABLE river_job ALTER COLUMN tags SET DEFAULT '{}';
UPDATE river_job SET tags = '{}' WHERE tags IS NULL;
ALTER TABLE river_job ALTER COLUMN tags SET NOT NULL;

-- +goose Down
-- +goose StatementBegin
ALTER TABLE river_job ALTER COLUMN tags DROP NOT NULL,
                      ALTER COLUMN tags DROP DEFAULT;
-- +goose StatementEnd
