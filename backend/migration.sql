-- ============================================================
-- TT-Scheduler Full Schema Migration
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- INSTITUTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS institutions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code        VARCHAR(20) UNIQUE NOT NULL,
    name        VARCHAR(255) NOT NULL,
    type        VARCHAR(50) NOT NULL,
    location    JSONB,
    contact     JSONB,
    settings    JSONB DEFAULT '{}'::JSONB,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW(),
    deleted_at  TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_institutions_code ON institutions(code);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID REFERENCES institutions(id) ON DELETE CASCADE,
    email           VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255),
    role            VARCHAR(50) DEFAULT 'admin',
    is_active       BOOLEAN DEFAULT TRUE,
    is_verified     BOOLEAN DEFAULT FALSE,
    preferences     JSONB DEFAULT '{}'::JSONB,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    deleted_at      TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_institution_id ON users(institution_id);

-- ============================================================
-- DEPARTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    code            VARCHAR(20) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    head_id         UUID,
    settings        JSONB DEFAULT '{}'::JSONB,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    deleted_at      TIMESTAMP,
    UNIQUE(institution_id, code)
);
CREATE INDEX IF NOT EXISTS idx_departments_institution_id ON departments(institution_id);

-- ============================================================
-- FACULTY
-- ============================================================
CREATE TABLE IF NOT EXISTS faculty (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id      UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    department_id       UUID REFERENCES departments(id) ON DELETE SET NULL,
    employee_id         VARCHAR(50),
    name                VARCHAR(255) NOT NULL,
    email               VARCHAR(255),
    phone               VARCHAR(20),
    specializations     JSONB DEFAULT '[]'::JSONB,
    max_hours_per_week  INTEGER DEFAULT 20,
    preferences         JSONB DEFAULT '{}'::JSONB,
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW(),
    deleted_at          TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_faculty_institution_id ON faculty(institution_id);
CREATE INDEX IF NOT EXISTS idx_faculty_department_id ON faculty(department_id);

-- ============================================================
-- STUDENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS students (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    student_id      VARCHAR(50),
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255),
    year            INTEGER,
    section         VARCHAR(10),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    deleted_at      TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_students_institution_id ON students(institution_id);

-- ============================================================
-- STUDENT BATCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS student_batches (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
    name            VARCHAR(255) NOT NULL,
    code            VARCHAR(50),
    year            INTEGER,
    section         VARCHAR(10),
    strength        INTEGER DEFAULT 30,
    program         VARCHAR(100),
    semester        VARCHAR(20),
    metadata        JSONB DEFAULT '{}'::JSONB,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    deleted_at      TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_student_batches_institution_id ON student_batches(institution_id);

-- ============================================================
-- COURSES
-- ============================================================
CREATE TABLE IF NOT EXISTS courses (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
    code            VARCHAR(20) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    credits         NUMERIC(4,2) DEFAULT 3,
    hours_per_week  INTEGER DEFAULT 3,
    course_type     VARCHAR(50) DEFAULT 'theory',
    requires_lab    BOOLEAN DEFAULT FALSE,
    metadata        JSONB DEFAULT '{}'::JSONB,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    deleted_at      TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_courses_institution_id ON courses(institution_id);
CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(code);

-- ============================================================
-- COURSE SECTIONS (assignment of course to batch + faculty)
-- ============================================================
CREATE TABLE IF NOT EXISTS course_sections (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id       UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    faculty_id      UUID REFERENCES faculty(id) ON DELETE SET NULL,
    batch_id        UUID REFERENCES student_batches(id) ON DELETE CASCADE,
    section_name    VARCHAR(50),
    semester        VARCHAR(20),
    academic_year   VARCHAR(20),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    deleted_at      TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_course_sections_course_id ON course_sections(course_id);
CREATE INDEX IF NOT EXISTS idx_course_sections_faculty_id ON course_sections(faculty_id);

-- ============================================================
-- CLASSROOMS / ROOMS
-- ============================================================
CREATE TABLE IF NOT EXISTS classrooms (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    room_number     VARCHAR(20) NOT NULL,
    building        VARCHAR(100),
    capacity        INTEGER DEFAULT 40,
    room_type       VARCHAR(50) DEFAULT 'classroom',
    facilities      JSONB DEFAULT '[]'::JSONB,
    is_available    BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    deleted_at      TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_classrooms_institution_id ON classrooms(institution_id);

-- ============================================================
-- PREDEFINED SLOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS predefined_slots (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    name            VARCHAR(100),
    start_time      VARCHAR(10) NOT NULL,
    end_time        VARCHAR(10) NOT NULL,
    day_of_week     VARCHAR(20),
    slot_order      INTEGER DEFAULT 1,
    is_break        BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_predefined_slots_institution_id ON predefined_slots(institution_id);

-- ============================================================
-- TIMETABLES
-- ============================================================
CREATE TABLE IF NOT EXISTS timetables (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id      UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    semester            VARCHAR(20),
    academic_year       VARCHAR(20),
    status              VARCHAR(30) DEFAULT 'draft',
    generation_params   JSONB DEFAULT '{}'::JSONB,
    metrics             JSONB DEFAULT '{}'::JSONB,
    created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW(),
    published_at        TIMESTAMP,
    deleted_at          TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_timetables_institution_id ON timetables(institution_id);
CREATE INDEX IF NOT EXISTS idx_timetables_status ON timetables(status);

-- ============================================================
-- TIMETABLE ENTRIES (individual assignment slots)
-- ============================================================
CREATE TABLE IF NOT EXISTS timetable_entries (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timetable_id    UUID NOT NULL REFERENCES timetables(id) ON DELETE CASCADE,
    course_id       UUID REFERENCES courses(id) ON DELETE SET NULL,
    faculty_id      UUID REFERENCES faculty(id) ON DELETE SET NULL,
    classroom_id    UUID REFERENCES classrooms(id) ON DELETE SET NULL,
    batch_id        UUID REFERENCES student_batches(id) ON DELETE SET NULL,
    slot_id         UUID REFERENCES predefined_slots(id) ON DELETE SET NULL,
    day_of_week     VARCHAR(20) NOT NULL,
    start_time      VARCHAR(10) NOT NULL,
    end_time        VARCHAR(10) NOT NULL,
    period_number   INTEGER,
    entry_type      VARCHAR(30) DEFAULT 'regular',
    metadata        JSONB DEFAULT '{}'::JSONB,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_timetable_id ON timetable_entries(timetable_id);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_faculty_id ON timetable_entries(faculty_id);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_classroom_id ON timetable_entries(classroom_id);

-- ============================================================
-- CUSTOM CONSTRAINTS
-- ============================================================
CREATE TABLE IF NOT EXISTS custom_constraints (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    constraint_type VARCHAR(100) NOT NULL,
    entity_type     VARCHAR(50),
    entity_id       UUID,
    parameters      JSONB DEFAULT '{}'::JSONB,
    priority        INTEGER DEFAULT 5,
    is_hard         BOOLEAN DEFAULT FALSE,
    description     TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_custom_constraints_institution_id ON custom_constraints(institution_id);

-- ============================================================
-- FACULTY PREFERENCES
-- ============================================================
CREATE TABLE IF NOT EXISTS faculty_preferences (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    faculty_id      UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
    preference_type VARCHAR(100) NOT NULL,
    day_of_week     VARCHAR(20),
    time_start      VARCHAR(10),
    time_end        VARCHAR(10),
    priority        INTEGER DEFAULT 5,
    notes           TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_faculty_preferences_faculty_id ON faculty_preferences(faculty_id);

-- ============================================================
-- CHANGE REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS change_requests (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timetable_id        UUID NOT NULL REFERENCES timetables(id) ON DELETE CASCADE,
    requested_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    entry_id            UUID REFERENCES timetable_entries(id) ON DELETE SET NULL,
    request_type        VARCHAR(50) NOT NULL,
    reason              TEXT,
    status              VARCHAR(30) DEFAULT 'pending',
    proposed_changes    JSONB DEFAULT '{}'::JSONB,
    reviewed_by         UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at         TIMESTAMP,
    review_notes        TEXT,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_change_requests_timetable_id ON change_requests(timetable_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    message         TEXT NOT NULL,
    type            VARCHAR(50) DEFAULT 'info',
    is_read         BOOLEAN DEFAULT FALSE,
    metadata        JSONB DEFAULT '{}'::JSONB,
    created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID REFERENCES institutions(id) ON DELETE SET NULL,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    action          VARCHAR(100) NOT NULL,
    entity_type     VARCHAR(100),
    entity_id       UUID,
    old_data        JSONB,
    new_data        JSONB,
    ip_address      VARCHAR(45),
    created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_institution_id ON audit_logs(institution_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- ============================================================
-- ISSUE REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS issue_reports (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID REFERENCES institutions(id) ON DELETE SET NULL,
    reported_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    issue_type      VARCHAR(100) NOT NULL,
    severity        VARCHAR(20) DEFAULT 'medium',
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    status          VARCHAR(30) DEFAULT 'open',
    resolution      TEXT,
    resolved_at     TIMESTAMP,
    metadata        JSONB DEFAULT '{}'::JSONB,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_issue_reports_institution_id ON issue_reports(institution_id);

-- ============================================================
-- ALEMBIC VERSION TRACKING
-- (lets alembic know the DB is fully migrated)
-- ============================================================
CREATE TABLE IF NOT EXISTS alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Mark as migrated (use any placeholder revision)
INSERT INTO alembic_version (version_num)
VALUES ('initial_schema_001')
ON CONFLICT DO NOTHING;

-- Done!
SELECT 'Schema created successfully ✅' AS result;
