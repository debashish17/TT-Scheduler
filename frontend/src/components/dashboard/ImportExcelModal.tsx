import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useOnboardingStore } from '../../store';
import { useWizardStore } from '../wizard/wizardStore';
import { Btn, Icon } from '../ui/primitives';
import toast from 'react-hot-toast';

interface ImportExcelModalProps {
  open: boolean;
  onClose: () => void;
}

type ImportKind = 'school' | 'college';

// ─── Sheet column reference ───────────────────────────────────────────
const SHEETS: Record<ImportKind, { sheet: string; cols: string }[]> = {
  school: [
    { sheet: 'Teachers', cols: 'name · subjects_can_teach' },
    { sheet: 'Subjects', cols: 'code · name · periods_per_week' },
    { sheet: 'Classes',  cols: 'name · size · subjects' },
    { sheet: 'Rooms',    cols: 'name · capacity' },
  ],
  college: [
    { sheet: 'Departments', cols: 'code · name' },
    { sheet: 'Courses',     cols: 'code · name · department · year · credits · lectures_per_week · has_lab · required_lecture_room_type · required_lab_room_type · enrolled_students · is_elective' },
    { sheet: 'Faculty',     cols: 'code · name · department · courses_can_teach · max_hours_per_week' },
    { sheet: 'Rooms',       cols: 'name · capacity · room_type' },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────
const splitCsv = (s: any): string[] =>
  String(s || '').split(',').map(x => x.trim()).filter(Boolean);

const truthy = (s: any): boolean => {
  const v = String(s || '').trim().toLowerCase();
  return v === 'true' || v === 'yes' || v === 'y' || v === '1';
};

// ─── Templates ────────────────────────────────────────────────────────
const buildSchoolTemplate = (): XLSX.WorkBook => {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['name',          'subjects_can_teach'],
    ['Alice Johnson', 'MATH, SCI'],
    ['Bob Smith',     'ENG, HIS'],
    ['Carol Davis',   'MATH, ENG'],
  ]), 'Teachers');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['code', 'name',        'periods_per_week'],
    ['MATH', 'Mathematics', 5],
    ['ENG',  'English',     4],
    ['SCI',  'Science',     4],
    ['HIS',  'History',     3],
  ]), 'Subjects');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['name',      'size', 'subjects'],
    ['Class 10A', 30,     'MATH, ENG, SCI, HIS'],
    ['Class 10B', 28,     'MATH, ENG, SCI, HIS'],
  ]), 'Classes');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['name',     'capacity'],
    ['Room 101', 35],
    ['Room 102', 35],
    ['Room 103', 30],
  ]), 'Rooms');

  return wb;
};

const buildCollegeTemplate = (): XLSX.WorkBook => {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['code', 'name'],
    ['CS',   'Computer Science'],
    ['IT',   'Information Technology'],
  ]), 'Departments');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['code',  'name',                    'department', 'year', 'credits', 'lectures_per_week', 'has_lab', 'required_lecture_room_type', 'required_lab_room_type', 'enrolled_students', 'is_elective'],
    ['CS501', 'Theory of Computation',   'CS',         3,      3,         3,                    'no',      'lecture_hall',                '',                       150,                'no'],
    ['CS502', 'Operating Systems Lab',   'CS',         3,      4,         3,                    'yes',     'lecture_hall',                'computer_lab',           110,                'no'],
    ['IT501', 'Software Engineering',    'IT',         3,      3,         3,                    'no',      'lecture_hall',                '',                       140,                'no'],
    ['IT502', 'Machine Learning',        'IT',         3,      2,         2,                    'no',      'classroom',                   '',                       100,                'yes'],
  ]), 'Courses');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['code',  'name',          'department', 'courses_can_teach', 'max_hours_per_week'],
    ['FAC01', 'Dr Alice Rao',  'CS',         'CS501, CS502',      18],
    ['FAC02', 'Dr Bob Khan',   'CS',         'CS501',             16],
    ['FAC03', 'Dr Carol Sen',  'IT',         'IT501, IT502',      18],
  ]), 'Faculty');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['name',         'capacity', 'room_type'],
    ['Lecture Hall A', 120,       'lecture_hall'],
    ['Lecture Hall B', 100,       'lecture_hall'],
    ['CS Lab 1',       60,        'computer_lab'],
  ]), 'Rooms');

  return wb;
};

// ─── Parsers ──────────────────────────────────────────────────────────
const parseSchoolWorkbook = (wb: XLSX.WorkBook) => {
  const sheet2json = (name: string) =>
    wb.Sheets[name]
      ? XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[name], { defval: '' })
      : [];

  const rawTeachers = sheet2json('Teachers');
  const rawSubjects = sheet2json('Subjects');
  const rawClasses  = sheet2json('Classes');
  const rawRooms    = sheet2json('Rooms');

  const teachers = rawTeachers.map((r, i) => ({
    name:     String(r.name || `Teacher ${i + 1}`),
    subjects: splitCsv(r.subjects_can_teach),
  }));

  const classes = rawClasses.map((r, i) => ({
    name:     String(r.name || `Class ${i + 1}`),
    size:     Number(r.size) || 30,
    subjects: splitCsv(r.subjects),  // intermediate field used to build target_classes
  }));

  // Build subject.target_classes from class.subjects (reverse map).
  // The wizard's Subject step expects `target_classes: string[]` — list of
  // class names this subject is taught to.
  const targetClassesByCode: Record<string, string[]> = {};
  for (const c of classes) {
    for (const code of c.subjects) {
      (targetClassesByCode[code] ||= []).push(c.name);
    }
  }

  const subjects = rawSubjects.map((r, i) => ({
    code:             String(r.code || `S${String(i + 1).padStart(3, '0')}`),
    name:             String(r.name || `Subject ${i + 1}`),
    periods_per_week: Number(r.periods_per_week) || 4,
    target_classes:   targetClassesByCode[String(r.code || '')] || [],
  }));

  // Strip the intermediate `subjects` field from classes — it's not part of
  // the wizard's class shape.
  const classesClean = classes.map(({ subjects: _drop, ...rest }) => rest);

  const rooms = rawRooms.map((r, i) => ({
    name:     String(r.name || `Room ${i + 1}`),
    capacity: Number(r.capacity) || 30,
  }));

  return { teachers, subjects, classes: classesClean, rooms };
};

const parseCollegeWorkbook = (wb: XLSX.WorkBook) => {
  const sheet2json = (name: string) =>
    wb.Sheets[name]
      ? XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[name], { defval: '' })
      : [];

  const rawDepts    = sheet2json('Departments');
  const rawCourses  = sheet2json('Courses');
  const rawFaculty  = sheet2json('Faculty');
  const rawRooms    = sheet2json('Rooms');

  // Departments are technically optional — derive from courses/faculty
  // department codes if the sheet is missing or empty.
  let departments = rawDepts.map(r => ({
    code: String(r.code || '').trim(),
    name: String(r.name || r.code || '').trim(),
  })).filter(d => d.code);

  if (departments.length === 0) {
    const seen = new Set<string>();
    for (const c of rawCourses) {
      const code = String(c.department || '').trim();
      if (code && !seen.has(code)) { seen.add(code); departments.push({ code, name: code }); }
    }
    for (const f of rawFaculty) {
      const code = String(f.department || '').trim();
      if (code && !seen.has(code)) { seen.add(code); departments.push({ code, name: code }); }
    }
  }

  const courseOfferings = rawCourses.map((r, i) => {
    const credits = Number(r.credits) || 3;
    const has_lab = truthy(r.has_lab) || credits === 4;
    const required_lab = String(r.required_lab_room_type || '').trim();
    return {
      code:                       String(r.code || `C${String(i + 1).padStart(3, '0')}`),
      name:                       String(r.name || `Course ${i + 1}`),
      department:                 String(r.department || '').trim(),
      year:                       Number(r.year) || 1,
      credits,
      lectures_per_week:          Number(r.lectures_per_week) || (credits === 2 ? 2 : 3),
      has_lab,
      required_lecture_room_type: String(r.required_lecture_room_type || 'classroom'),
      required_lab_room_type:     has_lab && required_lab ? required_lab : (has_lab ? 'computer_lab' : null),
      enrolled_students:          Number(r.enrolled_students) || 30,
      is_elective:                truthy(r.is_elective),
    };
  });

  const collegeFaculty = rawFaculty.map((r, i) => ({
    code:               String(r.code || `FAC${String(i + 1).padStart(2, '0')}`),
    name:               String(r.name || `Faculty ${i + 1}`),
    department:         String(r.department || '').trim(),
    courses_can_teach:  splitCsv(r.courses_can_teach),
    max_hours_per_week: Number(r.max_hours_per_week) || 18,
  }));

  const collegeRooms = rawRooms.map((r, i) => ({
    name:      String(r.name || `Room ${i + 1}`),
    capacity:  Number(r.capacity) || 40,
    room_type: String(r.room_type || 'classroom'),
  }));

  // Institution shell — wizard step 1 fills name + semester, but we set a
  // sane default with the discovered departments so the user doesn't have
  // to retype them.
  const collegeInstitution = {
    name: 'My College',
    semester: 1,
    departments,
  };

  return { courseOfferings, collegeFaculty, collegeRooms, collegeInstitution };
};

// ─── Component ────────────────────────────────────────────────────────
const ImportExcelModal: React.FC<ImportExcelModalProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const fileRef  = useRef<HTMLInputElement>(null);
  const [kind,     setKind]     = useState<ImportKind | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsing,  setParsing]  = useState(false);

  // Scroll the page to the top whenever the modal opens or its step changes,
  // so the modal (anchored near the viewport top via pt-[10vh]) is always
  // visible regardless of where the user was scrolled on the underlying page.
  useEffect(() => {
    if (open) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [open, kind]);

  const {
    setTeachersData, setSubjectsData, setClassesData, setRoomsData,
    setCollegeInstitution, setCourseOfferings, setCollegeFaculty, setCollegeRooms,
  } = useOnboardingStore();
  const setWorkflow = useWizardStore(s => s.setWorkflow);

  const reset = () => {
    setKind(null);
    setFileName('');
    setParsing(false);
    setDragging(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const downloadTemplate = () => {
    if (!kind) return;
    const wb = kind === 'college' ? buildCollegeTemplate() : buildSchoolTemplate();
    const filename = kind === 'college'
      ? 'TT-Scheduler-College-Import-Template.xlsx'
      : 'TT-Scheduler-School-Import-Template.xlsx';
    XLSX.writeFile(wb, filename);
    toast.success('Template downloaded');
  };

  const processFile = async (file: File) => {
    if (!kind) return;
    setParsing(true);
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);

      if (kind === 'school') {
        const { teachers, subjects, classes, rooms } = parseSchoolWorkbook(wb);
        if (!teachers.length && !subjects.length && !classes.length && !rooms.length) {
          toast.error('No data found. Check sheet names match the template exactly.');
          setParsing(false);
          return;
        }
        if (teachers.length) setTeachersData(teachers);
        if (subjects.length) setSubjectsData(subjects);
        if (classes.length)  setClassesData(classes);
        if (rooms.length)    setRoomsData(rooms);
        setWorkflow('school');

        const summary = [
          teachers.length && `${teachers.length} teachers`,
          subjects.length && `${subjects.length} subjects`,
          classes.length  && `${classes.length} classes`,
          rooms.length    && `${rooms.length} rooms`,
        ].filter(Boolean).join(', ');
        toast.success(`Imported ${summary} — review in wizard`);
      } else {
        const { courseOfferings, collegeFaculty, collegeRooms, collegeInstitution } =
          parseCollegeWorkbook(wb);
        if (!courseOfferings.length && !collegeFaculty.length && !collegeRooms.length) {
          toast.error('No data found. Check sheet names match the template exactly.');
          setParsing(false);
          return;
        }
        if (collegeInstitution.departments.length) setCollegeInstitution(collegeInstitution);
        if (courseOfferings.length) setCourseOfferings(courseOfferings);
        if (collegeFaculty.length)  setCollegeFaculty(collegeFaculty);
        if (collegeRooms.length)    setCollegeRooms(collegeRooms);
        setWorkflow('college');

        const summary = [
          courseOfferings.length && `${courseOfferings.length} courses`,
          collegeFaculty.length  && `${collegeFaculty.length} faculty`,
          collegeRooms.length    && `${collegeRooms.length} rooms`,
          collegeInstitution.departments.length && `${collegeInstitution.departments.length} departments`,
        ].filter(Boolean).join(', ');
        toast.success(`Imported ${summary} — review in wizard`);
      }

      handleClose();
      navigate('/wizard/step/1');
    } catch (err) {
      console.error('Import parse error:', err);
      toast.error('Could not parse file. Use the template format.');
    } finally {
      setParsing(false);
    }
  };

  const onFileChange = (f: File | null | undefined) => {
    if (f) processFile(f);
  };

  if (!open) return null;

  // ─── Step 0: kind picker ─────────────────────────────────────────
  if (!kind) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] pb-8 overflow-y-auto"
        style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
      >
        <div
          className="rounded-2xl shadow-2xl w-full max-w-[560px] mx-4 p-8"
          style={{ background: 'var(--paper)', color: 'var(--ink)' }}
        >
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="serif text-3xl tracking-tight mb-1">Import Excel</h2>
              <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
                Pick what you're scheduling — sheets and columns differ.
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-full transition-opacity hover:opacity-60"
              aria-label="Close"
            >
              <Icon name="x" size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {([
              {
                k: 'school' as const,
                emoji: '🏫',
                title: 'School',
                desc: 'Class-based schedule with teachers, subjects, and rooms.',
                hint: '4 sheets · ~5 min',
              },
              {
                k: 'college' as const,
                emoji: '🎓',
                title: 'College',
                desc: 'Department-based with courses, faculty, credits, and lab/lecture rooms.',
                hint: '4 sheets · ~10 min',
              },
            ]).map(card => (
              <button
                key={card.k}
                onClick={() => setKind(card.k)}
                className="text-left edge rounded-xl p-5 lift transition-all"
                style={{ background: 'var(--paper)' }}
              >
                <div className="text-3xl mb-3">{card.emoji}</div>
                <h3 className="serif text-2xl mb-1">{card.title}</h3>
                <p className="text-[13px] leading-relaxed mb-3" style={{ color: 'var(--ink-2)' }}>{card.desc}</p>
                <div className="flex items-center justify-between">
                  <span className="mono text-[10px]" style={{ color: 'var(--ink-3)' }}>{card.hint}</span>
                  <Icon name="arrow" size={13} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Step 1: upload (kind has been picked) ───────────────────────
  const sheetRef = SHEETS[kind];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="rounded-2xl shadow-2xl w-full max-w-[560px] mx-4 p-8"
        style={{ background: 'var(--paper)', color: 'var(--ink)' }}
      >
        {/* Header with back button */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <button
              onClick={() => reset()}
              className="text-[12px] mono mb-2 transition-opacity hover:opacity-60"
              style={{ color: 'var(--ink-3)' }}
            >
              ← Change type
            </button>
            <h2 className="serif text-3xl tracking-tight mb-1">
              Import {kind === 'college' ? 'College' : 'School'} Excel
            </h2>
            <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
              Upload a spreadsheet to pre-fill the timetable wizard
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-full transition-opacity hover:opacity-60"
            aria-label="Close"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Drop zone */}
        <div
          className="rounded-xl border-2 border-dashed p-10 text-center mb-5 transition-colors cursor-pointer"
          style={{
            borderColor: dragging ? 'var(--ink)' : 'var(--line)',
            background:  dragging ? 'var(--paper-2)' : 'transparent',
          }}
          onDragOver={e  => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault();
            setDragging(false);
            onFileChange(e.dataTransfer.files[0]);
          }}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={e => onFileChange(e.target.files?.[0])}
          />
          {parsing ? (
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'var(--ink)', borderTopColor: 'transparent' }}
              />
              <p className="text-sm" style={{ color: 'var(--ink-3)' }}>Parsing {fileName}…</p>
            </div>
          ) : (
            <>
              <Icon
                name="import"
                size={28}
                className="mx-auto mb-3"
                style={{ color: 'var(--ink-3)' } as React.CSSProperties}
              />
              <p className="font-medium text-sm mb-1">
                {fileName ? fileName : 'Drop your file here'}
              </p>
              <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
                {fileName ? 'Click to change file' : 'or click to browse · .xlsx  .xls  .csv'}
              </p>
            </>
          )}
        </div>

        {/* Sheet reference */}
        <div className="rounded-xl p-4 mb-6" style={{ background: 'var(--paper-2)' }}>
          <p className="text-[11px] mono font-medium mb-2.5" style={{ color: 'var(--ink-3)' }}>
            EXPECTED SHEET NAMES & COLUMNS
          </p>
          <div className="space-y-1.5">
            {sheetRef.map(s => (
              <div
                key={s.sheet}
                className="rounded-lg px-3 py-2"
                style={{ background: 'var(--paper)' }}
              >
                <div className="text-[11px] font-semibold mono mb-0.5">{s.sheet}</div>
                <div className="text-[10px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>{s.cols}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Btn variant="ghost" size="sm" onClick={downloadTemplate}>
            <Icon name="dl" size={13} /> Download {kind} template
          </Btn>
          <Btn variant="ghost" size="sm" onClick={handleClose} className="ml-auto">
            Cancel
          </Btn>
        </div>
      </div>
    </div>
  );
};

export default ImportExcelModal;
