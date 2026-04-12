-- ================================================================
-- user_timetable_snapshots — per-user full state persistence
-- Run this in: Supabase Dashboard → SQL Editor
-- ================================================================

CREATE TABLE IF NOT EXISTS user_timetable_snapshots (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL,                              -- Supabase auth user ID
    timetable_id        UUID REFERENCES timetables(id) ON DELETE SET NULL,
    institution_name    TEXT DEFAULT 'My School',
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW(),

    -- Complete onboarding inputs (stored as JSONB for full fidelity)
    institution_data    JSONB DEFAULT '{}'::JSONB,
    classes_data        JSONB DEFAULT '[]'::JSONB,
    subjects_data       JSONB DEFAULT '[]'::JSONB,
    teachers_data       JSONB DEFAULT '[]'::JSONB,
    time_data           JSONB DEFAULT '{}'::JSONB,
    rooms_data          JSONB DEFAULT '[]'::JSONB,
    constraints_data    JSONB DEFAULT '{}'::JSONB,

    -- Full solver result (assignments, grid, stats, warnings, time_slots, working_days)
    generated_timetable JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_snapshots_user_id
    ON user_timetable_snapshots(user_id);

CREATE INDEX IF NOT EXISTS idx_snapshots_user_created
    ON user_timetable_snapshots(user_id, created_at DESC);

-- ----------------------------------------------------------------
-- Row-Level Security — each user can only see their own rows
-- ----------------------------------------------------------------
ALTER TABLE user_timetable_snapshots ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to SELECT only their own rows
CREATE POLICY "snapshots_select_own"
    ON user_timetable_snapshots FOR SELECT
    USING (user_id = auth.uid());

-- Allow inserting rows only for the authenticated user
CREATE POLICY "snapshots_insert_own"
    ON user_timetable_snapshots FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Allow updating only own rows
CREATE POLICY "snapshots_update_own"
    ON user_timetable_snapshots FOR UPDATE
    USING (user_id = auth.uid());

-- Allow deleting only own rows
CREATE POLICY "snapshots_delete_own"
    ON user_timetable_snapshots FOR DELETE
    USING (user_id = auth.uid());

SELECT 'user_timetable_snapshots created successfully ✅' AS result;
