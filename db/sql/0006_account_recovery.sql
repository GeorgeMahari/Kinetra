BEGIN;

-- Running upgrade 0005 -> 0006

ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE auth_codes (
    id UUID NOT NULL, 
    user_id UUID NOT NULL, 
    purpose VARCHAR(20) NOT NULL, 
    code_hash VARCHAR(64) NOT NULL, 
    attempts SMALLINT NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    used_at TIMESTAMP WITH TIME ZONE, 
    CONSTRAINT pk_auth_codes PRIMARY KEY (id), 
    CONSTRAINT ck_auth_codes_purpose_valid CHECK (purpose IN ('verify_email', 'reset_password')), 
    CONSTRAINT ck_auth_codes_attempts_range CHECK (attempts BETWEEN 0 AND 100), 
    CONSTRAINT fk_auth_codes_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_auth_codes_user_id_purpose ON auth_codes (user_id, purpose);

UPDATE alembic_version SET version_num='0006' WHERE alembic_version.version_num = '0005';

COMMIT;

