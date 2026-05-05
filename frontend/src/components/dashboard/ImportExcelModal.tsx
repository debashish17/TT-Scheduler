import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useOnboardingStore } from '../../store';
import { Btn, Icon } from '../ui/primitives';
import toast from 'react-hot-toast';

interface ImportExcelModalProps {
  open: boolean;
  onClose: () => void;
}

const SHEETS = [
  { sheet: 'Teachers', cols: 'name · code · subjects_can_teach' },
  { sheet: 'Subjects',  cols: 'code · name · periods_per_week · type' },
  { sheet: 'Classes',   cols: 'name · size · subjects' },
  { sheet: 'Rooms',     cols: 'name · capacity · type' },
];

const ImportExcelModal: React.FC<ImportExcelModalProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const fileRef  = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsing,  setParsing]  = useState(false);

  const { setTeachersData, setSubjectsData, setClassesData, setRoomsData } = useOnboardingStore();

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['name',       'code',  'subjects_can_teach'],
      ['Alice Johnson', 'T001', 'MATH, SCI'],
      ['Bob Smith',     'T002', 'ENG, HIS'],
      ['Carol Davis',   'T003', 'MATH, ENG'],
    ]), 'Teachers');

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['code', 'name',        'periods_per_week', 'type'],
      ['MATH', 'Mathematics', 5,                  'lecture'],
      ['ENG',  'English',     4,                  'lecture'],
      ['SCI',  'Science',     4,                  'lecture'],
      ['HIS',  'History',     3,                  'lecture'],
    ]), 'Subjects');

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['name',      'size', 'subjects'],
      ['Class 10A', 30,     'MATH, ENG, SCI, HIS'],
      ['Class 10B', 28,     'MATH, ENG, SCI, HIS'],
    ]), 'Classes');

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['name',      'capacity', 'type'],
      ['Room 101',  35,         'classroom'],
      ['Room 102',  35,         'classroom'],
      ['Lab 1',     25,         'lab'],
    ]), 'Rooms');

    XLSX.writeFile(wb, 'TT-Scheduler-Import-Template.xlsx');
    toast.success('Template downloaded');
  };

  const processFile = async (file: File) => {
    setParsing(true);
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);

      const sheet2json = (name: string) => {
        const ws = wb.Sheets[name];
        if (!ws) return [];
        return XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
      };

      const rawTeachers = sheet2json('Teachers');
      const rawSubjects = sheet2json('Subjects');
      const rawClasses  = sheet2json('Classes');
      const rawRooms    = sheet2json('Rooms');

      const teachers = rawTeachers.map((r, i) => ({
        name:     String(r.name     || `Teacher ${i + 1}`),
        code:     String(r.code     || `T${String(i + 1).padStart(3, '0')}`),
        subjects: String(r.subjects_can_teach || '').split(',').map((s: string) => s.trim()).filter(Boolean),
      }));

      const subjects = rawSubjects.map((r, i) => ({
        code:             String(r.code             || `S${String(i + 1).padStart(3, '0')}`),
        name:             String(r.name             || `Subject ${i + 1}`),
        periods_per_week: Number(r.periods_per_week) || 4,
        type:             String(r.type             || 'lecture'),
      }));

      const classes = rawClasses.map((r, i) => ({
        name:     String(r.name || `Class ${i + 1}`),
        size:     Number(r.size) || 30,
        subjects: String(r.subjects || '').split(',').map((s: string) => s.trim()).filter(Boolean),
      }));

      const rooms = rawRooms.map((r, i) => ({
        name:     String(r.name     || `Room ${i + 1}`),
        capacity: Number(r.capacity) || 30,
        type:     String(r.type     || 'classroom'),
      }));

      if (!teachers.length && !subjects.length && !classes.length && !rooms.length) {
        toast.error('No data found. Check sheet names match the template exactly.');
        setParsing(false);
        return;
      }

      if (teachers.length) setTeachersData(teachers);
      if (subjects.length) setSubjectsData(subjects);
      if (classes.length)  setClassesData(classes);
      if (rooms.length)    setRoomsData(rooms);

      const summary = [
        teachers.length && `${teachers.length} teachers`,
        subjects.length && `${subjects.length} subjects`,
        classes.length  && `${classes.length} classes`,
        rooms.length    && `${rooms.length} rooms`,
      ].filter(Boolean).join(', ');

      toast.success(`Imported ${summary} — review in wizard`);
      onClose();
      navigate('/wizard');
    } catch {
      toast.error('Could not parse file. Use the template format.');
    } finally {
      setParsing(false);
    }
  };

  const onFileChange = (f: File | null | undefined) => {
    if (f) processFile(f);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-2xl shadow-2xl w-full max-w-[520px] mx-4 p-8"
        style={{ background: 'var(--paper)', color: 'var(--ink)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="serif text-3xl tracking-tight mb-1">Import Excel</h2>
            <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
              Upload a spreadsheet to pre-fill the timetable wizard
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full transition-opacity hover:opacity-60"
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
          <div className="grid grid-cols-2 gap-1.5">
            {SHEETS.map(s => (
              <div
                key={s.sheet}
                className="rounded-lg px-3 py-2"
                style={{ background: 'var(--paper)' }}
              >
                <div className="text-[11px] font-semibold mono mb-0.5">{s.sheet}</div>
                <div className="text-[10px]" style={{ color: 'var(--ink-3)' }}>{s.cols}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Btn variant="ghost" size="sm" onClick={downloadTemplate}>
            <Icon name="dl" size={13} /> Download template
          </Btn>
          <Btn variant="ghost" size="sm" onClick={onClose} className="ml-auto">
            Cancel
          </Btn>
        </div>
      </div>
    </div>
  );
};

export default ImportExcelModal;
