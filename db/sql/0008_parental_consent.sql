BEGIN;

-- Running upgrade 0007 -> 0008

ALTER TABLE users ADD COLUMN parental_consent_status VARCHAR(16) DEFAULT 'not_required' NOT NULL;

ALTER TABLE users ADD CONSTRAINT ck_users_parental_consent_status_valid CHECK (parental_consent_status IN ('not_required', 'pending', 'granted'));

CREATE TABLE parental_consents (
    id UUID NOT NULL, 
    user_id UUID NOT NULL, 
    parent_email VARCHAR(320) NOT NULL, 
    token_hash VARCHAR(64) NOT NULL, 
    policy_version VARCHAR(32) NOT NULL, 
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    last_sent_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    granted_at TIMESTAMP WITH TIME ZONE, 
    CONSTRAINT pk_parental_consents PRIMARY KEY (id), 
    CONSTRAINT fk_parental_consents_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    CONSTRAINT uq_parental_consents_user_id UNIQUE (user_id), 
    CONSTRAINT uq_parental_consents_token_hash UNIQUE (token_hash)
);

CREATE INDEX ix_parental_consents_expires_at_pending ON parental_consents (expires_at) WHERE granted_at IS NULL;

UPDATE alembic_version SET version_num='0008' WHERE alembic_version.version_num = '0007';

COMMIT;

