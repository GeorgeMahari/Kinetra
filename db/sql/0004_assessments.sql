BEGIN;

-- Running upgrade 0003 -> 0004

CREATE TABLE test_results (
    id UUID NOT NULL, 
    user_id UUID NOT NULL, 
    test_code VARCHAR(40) NOT NULL, 
    test_version VARCHAR(10) NOT NULL, 
    protocol_key VARCHAR(200) NOT NULL, 
    performed_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    status VARCHAR(20) NOT NULL, 
    inputs JSONB NOT NULL, 
    indicators JSONB NOT NULL, 
    engine_version VARCHAR(20) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_test_results PRIMARY KEY (id), 
    CONSTRAINT ck_test_results_status_valid CHECK (status IN ('completed', 'stopped_early')), 
    CONSTRAINT fk_test_results_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_test_results_user_id_test_code_performed_at ON test_results (user_id, test_code, performed_at);

CREATE TABLE measurements (
    id UUID NOT NULL, 
    user_id UUID NOT NULL, 
    kind VARCHAR(30) NOT NULL, 
    value NUMERIC(7, 2) NOT NULL, 
    measured_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    source VARCHAR(30) NOT NULL, 
    external_id VARCHAR(200), 
    test_result_id UUID, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_measurements PRIMARY KEY (id), 
    CONSTRAINT ck_measurements_kind_valid CHECK (kind IN ('weight_kg', 'waist_cm', 'resting_hr_bpm')), 
    CONSTRAINT ck_measurements_source_valid CHECK (source IN ('manual')), 
    CONSTRAINT fk_measurements_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    CONSTRAINT fk_measurements_test_result_id_test_results FOREIGN KEY(test_result_id) REFERENCES test_results (id) ON DELETE CASCADE, 
    CONSTRAINT uq_measurements_user_source_external UNIQUE (user_id, source, external_id)
);

CREATE INDEX ix_measurements_user_id_kind_measured_at ON measurements (user_id, kind, measured_at);

UPDATE alembic_version SET version_num='0004' WHERE alembic_version.version_num = '0003';

COMMIT;

