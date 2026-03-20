-- =====================================================
-- Timetable Scheduler Database Schema
-- Complete SQL Migration for Supabase PostgreSQL
-- Version: 1.0.0
-- Date: 2026-03-19
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUM TYPES
-- =====================================================

-- User roles
CREATE TYPE user_role AS ENUM ('super_admin', 'dept_admin', 'faculty', 'student');

-- Course types
CREATE TYPE course_type AS ENUM ('theory', 'lab', 'tutorial');

-- Slot types
CREATE TYPE slot_type AS ENUM ('theory', 'lab');

-- Room types
CREATE TYPE room_type AS ENUM ('lecture_hall', 'computer_lab', 'physics_lab', 'chemistry_lab', 'seminar_room', 'auditorium', 'tutorial_room');

-- Timetable status
CREATE TYPE timetable_status AS ENUM ('draft', 'active', 'archived');

-- Timetable entry status
CREATE TYPE entry_status AS ENUM ('scheduled', 'cancelled', 'rescheduled');

-- Change request types
CREATE TYPE request_type AS ENUM ('cancel', 'swap', 'leave', 'block_slot');

-- Change request status
CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- Issue categories
CREATE TYPE issue_category AS ENUM ('room_locked', 'faculty_absent', 'equipment_issue', 'timetable_error', 'other');

-- Issue status
CREATE TYPE issue_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- =====================================================
-- TABLE 1: INSTITUTIONS
-- =====================================================

CREATE TABLE institutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    location JSONB,
    contact JSONB,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_institutions_code ON institutions(code) WHERE deleted_at IS NULL;
CREATE INDEX idx_institutions_deleted ON institutions(deleted_at);

-- =====================================================
-- TABLE 2: DEPARTMENTS
-- =====================================================

CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    code VARCHAR(10) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    UNIQUE(institution_id, code)
);

CREATE INDEX idx_departments_institution ON departments(institution_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_departments_code ON departments(code);
CREATE INDEX idx_departments_deleted ON departments(deleted_at);

-- =====================================================
-- TABLE 3: USERS
-- =====================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    role user_role NOT NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_institution ON users(institution_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_deleted ON users(deleted_at);

-- =====================================================
-- TABLE 4: FACULTY
-- =====================================================

CREATE TABLE faculty (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    designation VARCHAR(50),
    max_hours_per_week INTEGER DEFAULT 18,
    subjects_can_teach TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_faculty_employee_id ON faculty(employee_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_faculty_department ON faculty(department_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_faculty_institution ON faculty(institution_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_faculty_deleted ON faculty(deleted_at);

-- =====================================================
-- TABLE 5: STUDENT_BATCHES
-- =====================================================

CREATE TABLE student_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    batch_name VARCHAR(50) NOT NULL,
    year INTEGER NOT NULL,
    semester INTEGER NOT NULL,
    student_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    UNIQUE(institution_id, batch_name)
);

CREATE INDEX idx_batches_institution ON student_batches(institution_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_batches_department ON student_batches(department_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_batches_deleted ON student_batches(deleted_at);

-- =====================================================
-- TABLE 6: COURSES
-- =====================================================

CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    course_type course_type NOT NULL DEFAULT 'theory',
    theory_credits DECIMAL(3,1) DEFAULT 0,
    lab_credits DECIMAL(3,1) DEFAULT 0,
    hours_per_week INTEGER NOT NULL,
    assigned_faculty_id UUID REFERENCES faculty(id) ON DELETE SET NULL,
    assigned_batch_id UUID REFERENCES student_batches(id) ON DELETE SET NULL,
    expected_students INTEGER DEFAULT 0,
    required_features TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    UNIQUE(institution_id, code)
);

CREATE INDEX idx_courses_institution ON courses(institution_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_courses_department ON courses(department_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_courses_faculty ON courses(assigned_faculty_id);
CREATE INDEX idx_courses_batch ON courses(assigned_batch_id);
CREATE INDEX idx_courses_code ON courses(code);
CREATE INDEX idx_courses_deleted ON courses(deleted_at);

-- =====================================================
-- TABLE 7: COURSE_SECTIONS
-- =====================================================

CREATE TABLE course_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    section_name VARCHAR(10) NOT NULL,
    max_students INTEGER NOT NULL,
    assigned_faculty_id UUID REFERENCES faculty(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(course_id, section_name)
);

CREATE INDEX idx_sections_course ON course_sections(course_id);
CREATE INDEX idx_sections_faculty ON course_sections(assigned_faculty_id);

-- =====================================================
-- TABLE 8: PREDEFINED_SLOTS
-- =====================================================

CREATE TABLE predefined_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    slot_code VARCHAR(10) NOT NULL,
    slot_type slot_type NOT NULL DEFAULT 'theory',
    timings JSONB NOT NULL,
    duration_minutes INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(institution_id, slot_code)
);

CREATE INDEX idx_slots_institution ON predefined_slots(institution_id);
CREATE INDEX idx_slots_type ON predefined_slots(slot_type);

-- =====================================================
-- TABLE 9: CLASSROOMS
-- =====================================================

CREATE TABLE classrooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    room_number VARCHAR(20) NOT NULL,
    building VARCHAR(100),
    capacity INTEGER NOT NULL,
    room_type room_type NOT NULL DEFAULT 'lecture_hall',
    features TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    UNIQUE(institution_id, room_number)
);

CREATE INDEX idx_classrooms_institution ON classrooms(institution_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_classrooms_type ON classrooms(room_type);
CREATE INDEX idx_classrooms_capacity ON classrooms(capacity);
CREATE INDEX idx_classrooms_deleted ON classrooms(deleted_at);

-- =====================================================
-- TABLE 10: TIMETABLES
-- =====================================================

CREATE TABLE timetables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    semester VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    status timetable_status NOT NULL DEFAULT 'draft',
    metrics JSONB DEFAULT '{}'::jsonb,
    generation_params JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_timetables_institution ON timetables(institution_id);
CREATE INDEX idx_timetables_status ON timetables(status);
CREATE INDEX idx_timetables_semester ON timetables(semester);

-- =====================================================
-- TABLE 11: TIMETABLE_ENTRIES
-- =====================================================

CREATE TABLE timetable_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timetable_id UUID NOT NULL REFERENCES timetables(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    section_id UUID REFERENCES course_sections(id) ON DELETE SET NULL,
    slot_id UUID NOT NULL REFERENCES predefined_slots(id) ON DELETE CASCADE,
    faculty_id UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
    classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES student_batches(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    time_slot VARCHAR(20) NOT NULL,
    status entry_status NOT NULL DEFAULT 'scheduled',
    is_substitute BOOLEAN DEFAULT FALSE,
    original_faculty_id UUID REFERENCES faculty(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_entries_timetable ON timetable_entries(timetable_id);
CREATE INDEX idx_entries_course ON timetable_entries(course_id);
CREATE INDEX idx_entries_faculty ON timetable_entries(faculty_id);
CREATE INDEX idx_entries_classroom ON timetable_entries(classroom_id);
CREATE INDEX idx_entries_batch ON timetable_entries(batch_id);
CREATE INDEX idx_entries_slot ON timetable_entries(slot_id);
CREATE INDEX idx_entries_day ON timetable_entries(day_of_week);

-- Unique constraint for scheduled entries (no room overlap)
CREATE UNIQUE INDEX idx_entries_room_slot ON timetable_entries(timetable_id, slot_id, classroom_id)
    WHERE status = 'scheduled';

-- =====================================================
-- TABLE 12: CUSTOM_CONSTRAINTS
-- =====================================================

CREATE TABLE custom_constraints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    constraint_type VARCHAR(50) NOT NULL,
    parameters JSONB DEFAULT '{}'::jsonb,
    priority INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_constraints_institution ON custom_constraints(institution_id);
CREATE INDEX idx_constraints_active ON custom_constraints(is_active);

-- =====================================================
-- TABLE 13: FACULTY_PREFERENCES
-- =====================================================

CREATE TABLE faculty_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    faculty_id UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
    semester VARCHAR(50) NOT NULL,
    preference_type VARCHAR(50) NOT NULL,
    preference_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_preferences_faculty ON faculty_preferences(faculty_id);
CREATE INDEX idx_preferences_semester ON faculty_preferences(semester);

-- =====================================================
-- TABLE 14: CHANGE_REQUESTS
-- =====================================================

CREATE TABLE change_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_type request_type NOT NULL,
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    timetable_id UUID REFERENCES timetables(id) ON DELETE CASCADE,
    request_data JSONB NOT NULL,
    reason TEXT,
    date_from DATE,
    date_to DATE,
    status request_status NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    review_comment TEXT,
    reviewed_at TIMESTAMP,
    conflicts JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_requests_requested_by ON change_requests(requested_by);
CREATE INDEX idx_requests_status ON change_requests(status);
CREATE INDEX idx_requests_type ON change_requests(request_type);
CREATE INDEX idx_requests_timetable ON change_requests(timetable_id);

-- =====================================================
-- TABLE 15: NOTIFICATIONS
-- =====================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_type user_role NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    related_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- =====================================================
-- TABLE 16: AUDIT_LOGS
-- =====================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    old_value JSONB,
    new_value JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- =====================================================
-- TABLE 17: STUDENTS
-- =====================================================

CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    student_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    batch_id UUID NOT NULL REFERENCES student_batches(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_students_student_id ON students(student_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_students_batch ON students(batch_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_students_institution ON students(institution_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_students_deleted ON students(deleted_at);

-- =====================================================
-- TABLE 18: ISSUE_REPORTS
-- =====================================================

CREATE TABLE issue_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reported_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category issue_category NOT NULL,
    description TEXT NOT NULL,
    related_entry_id UUID REFERENCES timetable_entries(id) ON DELETE SET NULL,
    status issue_status NOT NULL DEFAULT 'open',
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_issues_reported_by ON issue_reports(reported_by);
CREATE INDEX idx_issues_status ON issue_reports(status);
CREATE INDEX idx_issues_category ON issue_reports(category);
CREATE INDEX idx_issues_assigned ON issue_reports(assigned_to);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to tables with updated_at
CREATE TRIGGER update_institutions_updated_at BEFORE UPDATE ON institutions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_faculty_updated_at BEFORE UPDATE ON faculty
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON student_batches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sections_updated_at BEFORE UPDATE ON course_sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_classrooms_updated_at BEFORE UPDATE ON classrooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_timetables_updated_at BEFORE UPDATE ON timetables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entries_updated_at BEFORE UPDATE ON timetable_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_preferences_updated_at BEFORE UPDATE ON faculty_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_requests_updated_at BEFORE UPDATE ON change_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_issues_updated_at BEFORE UPDATE ON issue_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE institutions IS 'Educational institutions using the system';
COMMENT ON TABLE departments IS 'Academic departments within institutions';
COMMENT ON TABLE users IS 'System users with different roles';
COMMENT ON TABLE faculty IS 'Faculty members who teach courses';
COMMENT ON TABLE student_batches IS 'Student groups/batches/sections';
COMMENT ON TABLE courses IS 'Academic courses offered';
COMMENT ON TABLE course_sections IS 'Multiple sections of the same course';
COMMENT ON TABLE predefined_slots IS 'Time slot definitions';
COMMENT ON TABLE classrooms IS 'Physical rooms/classrooms';
COMMENT ON TABLE timetables IS 'Generated timetable versions';
COMMENT ON TABLE timetable_entries IS 'Individual class assignments in timetable';
COMMENT ON TABLE custom_constraints IS 'Institution-specific constraints';
COMMENT ON TABLE faculty_preferences IS 'Faculty scheduling preferences';
COMMENT ON TABLE change_requests IS 'Requests for timetable modifications';
COMMENT ON TABLE notifications IS 'User notifications';
COMMENT ON TABLE audit_logs IS 'System activity audit trail';
COMMENT ON TABLE students IS 'Student records';
COMMENT ON TABLE issue_reports IS 'Issues and problems reported by users';

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================

-- Uncomment below to insert sample data for testing

/*
-- Sample Institution
INSERT INTO institutions (code, name, type, location, contact) VALUES
('INST001', 'Sample University', 'University',
 '{"city": "New York", "state": "NY", "country": "USA"}'::jsonb,
 '{"phone": "+1-234-567-8900", "email": "info@sampleuniv.edu"}'::jsonb);

-- Sample Department
INSERT INTO departments (institution_id, code, name) VALUES
((SELECT id FROM institutions WHERE code = 'INST001'), 'CSE', 'Computer Science & Engineering');

-- Add more sample data as needed
*/

-- =====================================================
-- END OF SCHEMA
-- =====================================================
