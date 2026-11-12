BEGIN;

-- Running upgrade 0002 -> 0003

CREATE TABLE sports (
    code VARCHAR(40) NOT NULL, 
    category VARCHAR(20) NOT NULL, 
    sort_order SMALLINT NOT NULL, 
    is_active BOOLEAN NOT NULL, 
    CONSTRAINT pk_sports PRIMARY KEY (code), 
    CONSTRAINT ck_sports_category_valid CHECK (category IN ('endurance', 'strength', 'team', 'racket', 'combat', 'mind_body', 'mixed'))
);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('running', 'endurance', 0, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('cycling', 'endurance', 1, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('swimming', 'endurance', 2, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('walking_hiking', 'endurance', 3, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('rowing', 'endurance', 4, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('triathlon', 'endurance', 5, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('cross_country_skiing', 'endurance', 6, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('gym_strength', 'strength', 7, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('weightlifting', 'strength', 8, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('calisthenics', 'strength', 9, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('crossfit', 'mixed', 10, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('climbing', 'mixed', 11, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('football', 'team', 12, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('basketball', 'team', 13, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('volleyball', 'team', 14, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('handball', 'team', 15, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('ice_hockey', 'team', 16, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('rugby', 'team', 17, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('tennis', 'racket', 18, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('badminton', 'racket', 19, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('table_tennis', 'racket', 20, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('padel', 'racket', 21, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('martial_arts', 'combat', 22, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('boxing', 'combat', 23, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('wrestling', 'combat', 24, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('yoga', 'mind_body', 25, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('pilates', 'mind_body', 26, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('dance', 'mind_body', 27, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('alpine_skiing', 'mixed', 28, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('other', 'mixed', 29, true);

CREATE TABLE user_goals (
    user_id UUID NOT NULL, 
    goal VARCHAR(40) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_user_goals PRIMARY KEY (user_id, goal), 
    CONSTRAINT ck_user_goals_goal_valid CHECK (goal IN ('improve_endurance', 'get_stronger', 'improve_mobility', 'improve_balance', 'healthy_weight', 'better_recovery', 'sport_performance', 'general_wellbeing', 'know_baseline')), 
    CONSTRAINT fk_user_goals_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE activity_profiles (
    id UUID NOT NULL, 
    user_id UUID NOT NULL, 
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    source VARCHAR(20) NOT NULL, 
    activity_level VARCHAR(20) NOT NULL, 
    exercise_sessions_per_week SMALLINT NOT NULL, 
    typical_session_minutes SMALLINT, 
    training_experience VARCHAR(30) NOT NULL, 
    strength_sessions_per_week SMALLINT, 
    cardio_sessions_per_week SMALLINT, 
    mobility_practice VARCHAR(20), 
    stairs_tolerance VARCHAR(30), 
    floor_rise VARCHAR(20), 
    sleep_hours NUMERIC(3, 1), 
    sleep_quality VARCHAR(10), 
    rules_version VARCHAR(40) NOT NULL, 
    CONSTRAINT pk_activity_profiles PRIMARY KEY (id), 
    CONSTRAINT ck_activity_profiles_source_valid CHECK (source IN ('onboarding', 'update')), 
    CONSTRAINT ck_activity_profiles_activity_level_valid CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')), 
    CONSTRAINT ck_activity_profiles_training_experience_valid CHECK (training_experience IN ('none', 'under_1_year', 'one_to_three_years', 'over_3_years')), 
    CONSTRAINT ck_activity_profiles_sessions_range CHECK (exercise_sessions_per_week BETWEEN 0 AND 21), 
    CONSTRAINT ck_activity_profiles_session_minutes_range CHECK (typical_session_minutes IS NULL OR typical_session_minutes BETWEEN 5 AND 600), 
    CONSTRAINT ck_activity_profiles_strength_sessions_range CHECK (strength_sessions_per_week IS NULL OR strength_sessions_per_week BETWEEN 0 AND 21), 
    CONSTRAINT ck_activity_profiles_cardio_sessions_range CHECK (cardio_sessions_per_week IS NULL OR cardio_sessions_per_week BETWEEN 0 AND 21), 
    CONSTRAINT ck_activity_profiles_mobility_practice_valid CHECK (mobility_practice IS NULL OR mobility_practice IN ('none', 'occasional', 'regular')), 
    CONSTRAINT ck_activity_profiles_stairs_tolerance_valid CHECK (stairs_tolerance IS NULL OR stairs_tolerance IN ('easily', 'with_effort', 'not_without_stopping')), 
    CONSTRAINT ck_activity_profiles_floor_rise_valid CHECK (floor_rise IS NULL OR floor_rise IN ('easily', 'with_effort', 'needs_support')), 
    CONSTRAINT ck_activity_profiles_sleep_hours_range CHECK (sleep_hours IS NULL OR sleep_hours BETWEEN 2 AND 16), 
    CONSTRAINT ck_activity_profiles_sleep_quality_valid CHECK (sleep_quality IS NULL OR sleep_quality IN ('poor', 'fair', 'good')), 
    CONSTRAINT fk_activity_profiles_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_activity_profiles_user_id_recorded_at ON activity_profiles (user_id, recorded_at);

CREATE TABLE activity_profile_sports (
    profile_id UUID NOT NULL, 
    sport_code VARCHAR(40) NOT NULL, 
    sessions_per_week SMALLINT NOT NULL, 
    CONSTRAINT pk_activity_profile_sports PRIMARY KEY (profile_id, sport_code), 
    CONSTRAINT ck_activity_profile_sports_sessions_range CHECK (sessions_per_week BETWEEN 0 AND 21), 
    CONSTRAINT fk_activity_profile_sports_profile_id_activity_profiles FOREIGN KEY(profile_id) REFERENCES activity_profiles (id) ON DELETE CASCADE, 
    CONSTRAINT fk_activity_profile_sports_sport_code_sports FOREIGN KEY(sport_code) REFERENCES sports (code)
);

CREATE TABLE readiness_screenings (
    id UUID NOT NULL, 
    user_id UUID NOT NULL, 
    answered_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    version VARCHAR(40) NOT NULL, 
    answers JSONB NOT NULL, 
    result VARCHAR(20) NOT NULL, 
    intensity_ceiling VARCHAR(20) NOT NULL, 
    CONSTRAINT pk_readiness_screenings PRIMARY KEY (id), 
    CONSTRAINT ck_readiness_screenings_result_valid CHECK (result IN ('clear', 'caution', 'consult')), 
    CONSTRAINT ck_readiness_screenings_intensity_ceiling_valid CHECK (intensity_ceiling IN ('maximal', 'submaximal', 'non_exertional')), 
    CONSTRAINT fk_readiness_screenings_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_readiness_screenings_user_id_answered_at ON readiness_screenings (user_id, answered_at);

CREATE TABLE onboarding_states (
    user_id UUID NOT NULL, 
    step SMALLINT NOT NULL, 
    draft JSONB NOT NULL, 
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    completed_at TIMESTAMP WITH TIME ZONE, 
    CONSTRAINT pk_onboarding_states PRIMARY KEY (user_id), 
    CONSTRAINT ck_onboarding_states_step_range CHECK (step BETWEEN 0 AND 20), 
    CONSTRAINT fk_onboarding_states_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

UPDATE alembic_version SET version_num='0003' WHERE alembic_version.version_num = '0002';

COMMIT;

