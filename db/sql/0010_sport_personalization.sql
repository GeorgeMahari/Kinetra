BEGIN;

-- Running upgrade 0009 -> 0010

ALTER TABLE user_goals ADD COLUMN rank SMALLINT;

ALTER TABLE user_goals ADD CONSTRAINT ck_user_goals_rank_range CHECK (rank IS NULL OR rank BETWEEN 1 AND 3);

ALTER TABLE user_goals DROP CONSTRAINT ck_user_goals_goal_valid;

ALTER TABLE user_goals ADD CONSTRAINT ck_user_goals_goal_valid CHECK (goal IN ('improve_endurance', 'get_stronger', 'improve_mobility', 'improve_balance', 'healthy_weight', 'better_recovery', 'sport_performance', 'general_wellbeing', 'know_baseline', 'build_muscle', 'power_speed', 'agility_coordination'));

ALTER TABLE activity_profile_sports ADD COLUMN level VARCHAR(20);

ALTER TABLE activity_profile_sports ADD CONSTRAINT ck_activity_profile_sports_level_valid CHECK (level IS NULL OR level IN ('beginner', 'intermediate', 'advanced'));

CREATE TABLE user_capacity_priorities (
    user_id UUID NOT NULL, 
    capacity VARCHAR(30) NOT NULL, 
    weight SMALLINT NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_user_capacity_priorities PRIMARY KEY (user_id, capacity), 
    CONSTRAINT ck_user_capacity_priorities_capacity_valid CHECK (capacity IN ('aerobic_endurance', 'recovery_hr', 'max_strength', 'hypertrophy', 'muscular_endurance', 'power', 'speed', 'agility', 'reaction', 'mobility', 'balance', 'body_composition', 'sleep_recovery')), 
    CONSTRAINT ck_user_capacity_priorities_weight_range CHECK (weight BETWEEN 1 AND 3), 
    CONSTRAINT fk_user_capacity_priorities_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('athletics_sprints', 'mixed', 30, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('athletics_jumps', 'mixed', 31, true);

INSERT INTO sports (code, category, sort_order, is_active) VALUES ('athletics_throws', 'strength', 32, true);

UPDATE alembic_version SET version_num='0010' WHERE alembic_version.version_num = '0009';

COMMIT;

