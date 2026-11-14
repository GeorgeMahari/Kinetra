BEGIN;

-- Running upgrade 0008 -> 0009

CREATE TABLE improvement_plans (
    id UUID NOT NULL, 
    user_id UUID NOT NULL, 
    version VARCHAR(20) NOT NULL, 
    status VARCHAR(12) NOT NULL, 
    started_on DATE NOT NULL, 
    ended_on DATE, 
    params JSONB NOT NULL, 
    target JSONB, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_improvement_plans PRIMARY KEY (id), 
    CONSTRAINT ck_improvement_plans_status_valid CHECK (status IN ('active', 'completed', 'abandoned')), 
    CONSTRAINT fk_improvement_plans_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX uq_improvement_plans_one_active ON improvement_plans (user_id) WHERE status = 'active';

CREATE TABLE plan_task_completions (
    id UUID NOT NULL, 
    user_id UUID NOT NULL, 
    plan_id UUID NOT NULL, 
    day DATE NOT NULL, 
    task_code VARCHAR(40) NOT NULL, 
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_plan_task_completions PRIMARY KEY (id), 
    CONSTRAINT fk_plan_task_completions_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    CONSTRAINT fk_plan_task_completions_plan_id_improvement_plans FOREIGN KEY(plan_id) REFERENCES improvement_plans (id) ON DELETE CASCADE, 
    CONSTRAINT uq_plan_task_completions_plan_day_task UNIQUE (plan_id, day, task_code)
);

CREATE INDEX ix_plan_task_completions_user_day ON plan_task_completions (user_id, day);

UPDATE alembic_version SET version_num='0009' WHERE alembic_version.version_num = '0008';

COMMIT;

