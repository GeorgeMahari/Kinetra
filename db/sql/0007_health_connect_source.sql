BEGIN;

-- Running upgrade 0006 -> 0007

ALTER TABLE measurements DROP CONSTRAINT ck_measurements_kind_valid;

ALTER TABLE measurements ADD CONSTRAINT ck_measurements_kind_valid CHECK (kind IN ('weight_kg', 'waist_cm', 'resting_hr_bpm', 'steps_daily'));

ALTER TABLE measurements DROP CONSTRAINT ck_measurements_source_valid;

ALTER TABLE measurements ADD CONSTRAINT ck_measurements_source_valid CHECK (source IN ('manual', 'health_connect'));

UPDATE alembic_version SET version_num='0007' WHERE alembic_version.version_num = '0006';

COMMIT;

