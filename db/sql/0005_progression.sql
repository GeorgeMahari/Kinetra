BEGIN;

-- Running upgrade 0004 -> 0005

CREATE TABLE activity_checkins (
    id UUID NOT NULL, 
    user_id UUID NOT NULL, 
    week_start DATE NOT NULL, 
    sessions SMALLINT NOT NULL, 
    active_minutes SMALLINT, 
    strength_sessions SMALLINT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_activity_checkins PRIMARY KEY (id), 
    CONSTRAINT ck_activity_checkins_week_start_is_monday CHECK (EXTRACT(ISODOW FROM week_start) = 1), 
    CONSTRAINT ck_activity_checkins_sessions_range CHECK (sessions BETWEEN 0 AND 21), 
    CONSTRAINT ck_activity_checkins_minutes_range CHECK (active_minutes IS NULL OR active_minutes BETWEEN 0 AND 3000), 
    CONSTRAINT ck_activity_checkins_strength_sessions_range CHECK (strength_sessions IS NULL OR strength_sessions BETWEEN 0 AND 21), 
    CONSTRAINT fk_activity_checkins_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    CONSTRAINT uq_activity_checkins_user_week UNIQUE (user_id, week_start)
);

CREATE TABLE user_achievements (
    user_id UUID NOT NULL, 
    code VARCHAR(40) NOT NULL, 
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    context JSONB NOT NULL, 
    CONSTRAINT pk_user_achievements PRIMARY KEY (user_id, code), 
    CONSTRAINT fk_user_achievements_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

UPDATE alembic_version SET version_num='0005' WHERE alembic_version.version_num = '0004';

COMMIT;

