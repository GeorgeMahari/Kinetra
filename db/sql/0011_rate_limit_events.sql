BEGIN;

-- Running upgrade 0010 -> 0011

CREATE TABLE rate_limit_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY, 
    key VARCHAR(400) NOT NULL, 
    at TIMESTAMP WITH TIME ZONE NOT NULL, 
    CONSTRAINT pk_rate_limit_events PRIMARY KEY (id)
);

CREATE INDEX ix_rate_limit_events_key_at ON rate_limit_events (key, at);

UPDATE alembic_version SET version_num='0011' WHERE alembic_version.version_num = '0010';

COMMIT;

