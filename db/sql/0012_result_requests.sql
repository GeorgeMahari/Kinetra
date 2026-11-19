BEGIN;

-- Running upgrade 0011 -> 0012

CREATE TABLE result_requests (
    user_id UUID NOT NULL, 
    key UUID NOT NULL, 
    result_id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_result_requests PRIMARY KEY (user_id, key), 
    CONSTRAINT fk_result_requests_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    CONSTRAINT fk_result_requests_result_id_test_results FOREIGN KEY(result_id) REFERENCES test_results (id) ON DELETE CASCADE
);

CREATE INDEX ix_result_requests_result_id ON result_requests (result_id);

CREATE INDEX ix_result_requests_created_at ON result_requests (created_at);

UPDATE alembic_version SET version_num='0012' WHERE alembic_version.version_num = '0011';

COMMIT;

