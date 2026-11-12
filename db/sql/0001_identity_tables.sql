BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 0001

CREATE TYPE user_status AS ENUM ('active', 'disabled');

CREATE TABLE users (
    id UUID NOT NULL, 
    email VARCHAR(320) NOT NULL, 
    password_hash VARCHAR(255) NOT NULL, 
    status user_status NOT NULL, 
    preferred_locale VARCHAR(10) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_users PRIMARY KEY (id), 
    CONSTRAINT ck_users_preferred_locale_supported CHECK (preferred_locale IN ('en', 'ro', 'ru'))
);

CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email));

CREATE TYPE sex_for_norms AS ENUM ('female', 'male', 'not_specified');

CREATE TABLE user_profiles (
    user_id UUID NOT NULL, 
    display_name VARCHAR(80), 
    date_of_birth DATE, 
    sex_for_norms sex_for_norms NOT NULL, 
    height_cm NUMERIC(4, 1), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_user_profiles PRIMARY KEY (user_id), 
    CONSTRAINT ck_user_profiles_height_cm_range CHECK (height_cm IS NULL OR (height_cm BETWEEN 50 AND 260)), 
    CONSTRAINT ck_user_profiles_date_of_birth_range CHECK (date_of_birth IS NULL OR date_of_birth > DATE '1900-01-01'), 
    CONSTRAINT fk_user_profiles_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

INSERT INTO alembic_version (version_num) VALUES ('0001') RETURNING alembic_version.version_num;

COMMIT;

