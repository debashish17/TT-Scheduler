import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboardingStore } from '../../store';
import { Btn, TopBar } from '../ui/primitives';
import { buildSubjectColor, CollegeTable, Legend } from './SharedTimetableGrid';

const NAV = [
  { id: 'timetable',    label: 'Class',     path: '/timetable'    },
  { id: 'faculty-view', label: 'Faculty',   path: '/faculty-view' },
  { id: 'student-view', label: 'Student',   path: '/student-view' },
  { id: 'analytics',    label: 'Analytics', path: '/analytics'    },
  { id: 'history',      label: 'History',   path: '/history'      },
];

const CollegeTimetableGrid: React.FC = () => {
  const navigate = useNavigate();
  const { generatedTimetable } = useOnboardingStore();

  if (!generatedTimetable) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center py-24">
        <h2 className="serif text-4xl tracking-tight mb-2">No timetable yet</h2>
        <p className="text-sm mb-8" style={{ color: 'var(--ink-3)' }}>
          Complete the college wizard to generate a schedule.
        </p>
        <Btn variant="primary" size="md" onClick={() => navigate('/wizard')}>Start wizard</Btn>
      </div>
    );
  }

  const {
    assignments = [],
    working_days = [],
    time_slots = [],
    stats = {},
    warnings = [],
    lunch_period_index = -1,
    sections_derived = [],
  } = generatedTimetable as any;

  const lunchPeriod: number = lunch_period_index >= 0 ? lunch_period_index + 1 : -1;
  const allCodes = [...new Set((assignments as any[]).map((a: any) => a.subject_code))].sort() as string[];
  const codeColor = buildSubjectColor(allCodes);
  const hasLab = (assignments as any[]).some((a: any) => a.course_type === 'lab');

  const [selectedCode, setSelectedCode] = useState<string>(allCodes[0] || '');
  const currentCode = selectedCode;

  const periods = (time_slots as any[]).map((s: any, i: number) => ({ period: i + 1, ...s }));
  const errors   = (warnings as any[]).filter((w: any) => w.level === 'error');
  const cautions = (warnings as any[]).filter((w: any) => w.level === 'warning');

  const courseAssignments = (assignments as any[]).filter((a: any) => a.subject_code === currentCode);

  return (
    <div className="screen-enter">
      <TopBar title="Timetable" crumbs={['College', currentCode]} actions={null} />

      <div className="p-8 max-w-[1600px] mx-auto">
        {/* View nav */}
        <div className="flex gap-1 mb-6 edge rounded-full overflow-hidden p-1 w-fit" style={{ background: 'var(--paper)' }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => navigate(n.path)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
              style={{
                background: window.location.pathname === n.path ? 'var(--ink)' : 'transparent',
                color: window.location.pathname === n.path ? 'var(--paper)' : 'var(--ink-3)',
              }}>
              {n.label}
            </button>
          ))}
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-6 mb-6 text-sm mono" style={{ color: 'var(--ink-3)' }}>
          <span>{(stats as any).solver || 'CP-SAT-College'}</span>
          <span style={{ color: 'var(--line)' }}>|</span>
          <span>{(assignments as any[]).length} assignments</span>
          <span style={{ color: 'var(--line)' }}>|</span>
          <span>{(stats as any).solve_time_seconds?.toFixed(1) ?? '—'}s solve</span>
          <span style={{ color: 'var(--line)' }}>|</span>
          <span style={{ color: (stats as any).clashes === 0 ? 'var(--ok)' : 'var(--err)' }}>
            {(stats as any).clashes ?? 0} clashes
          </span>
        </div>

        {/* Warnings */}
        {(errors.length > 0 || cautions.length > 0) && (
          <div className="space-y-2 mb-6">
            {[...errors, ...cautions].map((w: any, i: number) => (
              <div key={i} className="flex gap-3 items-start rounded-xl px-4 py-3"
                style={{ background: w.level === 'error' ? '#FEF2F2' : '#FFFBEB', border: `1px solid ${w.level === 'error' ? '#FECACA' : '#FDE68A'}` }}>
                <p className="text-sm">{w.message}</p>
              </div>
            ))}
          </div>
        )}

        {/* Course pills */}
        {allCodes.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {allCodes.map(code => (
              <button key={code} onClick={() => setSelectedCode(code)}
                className="px-3 py-1 rounded-full text-sm font-medium transition-colors"
                style={{
                  background: currentCode === code ? 'var(--ink)' : 'var(--paper)',
                  color: currentCode === code ? 'var(--paper)' : 'var(--ink-2)',
                  border: `1px solid ${currentCode === code ? 'var(--ink)' : 'var(--line)'}`,
                }}>
                {code}
              </button>
            ))}
          </div>
        )}

        {/* Section summary for selected course */}
        {(() => {
          const courseSections = (sections_derived as any[]).filter((s: any) => s.course_code === currentCode);
          if (courseSections.length === 0) return null;
          const totalStudents = courseSections.reduce((sum: number, s: any) => sum + (s.student_count ?? 0), 0);
          return (
            <div className="edge rounded-xl overflow-hidden mb-6" style={{ background: 'var(--paper)' }}>
              <div className="px-4 py-2.5 flex items-center justify-between"
                style={{ background: 'var(--paper-2)', borderBottom: '1px solid var(--line)' }}>
                <span className="text-[11px] mono font-semibold" style={{ color: 'var(--ink-3)' }}>
                  {currentCode} · {courseSections.length} section{courseSections.length !== 1 ? 's' : ''} · {totalStudents} students total
                </span>
              </div>
              <div className="flex divide-x" style={{ borderColor: 'var(--line)' }}>
                {courseSections.map((sec: any) => (
                  <div key={sec.section_label} className="flex-1 px-4 py-3 min-w-0">
                    <div className="text-[11px] font-semibold mb-0.5" style={{ color: 'var(--ink)' }}>Sec {sec.section_label}</div>
                    <div className="text-[11px]" style={{ color: 'var(--ink-2)' }}>{sec.student_count} students</div>
                    {sec.faculty_name && <div className="text-[11px] truncate" style={{ color: 'var(--ink-3)' }}>{sec.faculty_name}</div>}
                    {sec.room_name && <div className="text-[11px] truncate" style={{ color: 'var(--ink-3)' }}>{sec.room_name}</div>}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Grid */}
        <div className="edge rounded-xl overflow-hidden mb-6" style={{ background: 'var(--paper)' }}>
          <div className="overflow-x-auto">
            <CollegeTable
              assignments={courseAssignments}
              working_days={working_days}
              periods={periods}
              lunchPeriod={lunchPeriod}
              codeColor={codeColor}
              hasLab={hasLab}
            />
          </div>
          <Legend codes={allCodes} codeColor={codeColor} assignments={assignments} />
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between">
          <Btn variant="ghost" size="sm" onClick={() => navigate('/wizard')}>← Regenerate</Btn>
        </div>
      </div>
    </div>
  );
};

export default CollegeTimetableGrid;
