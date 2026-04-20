import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboardingStore } from '../../store';
import { Btn, Eyebrow, Icon, TopBar } from '../ui/primitives';
import DownloadModal from '../ui/DownloadModal';

const PALETTE = [
  '#0369A1', '#0F766E', '#7C3AED', '#B45309',
  '#BE185D', '#065F46', '#1D4ED8', '#9D174D',
];

const NAV = [
  { id: 'timetable',    label: 'Class',     path: '/timetable'    },
  { id: 'faculty-view', label: 'Faculty',   path: '/faculty-view' },
  { id: 'student-view', label: 'Student',   path: '/student-view' },
  { id: 'analytics',    label: 'Analytics', path: '/analytics'    },
  { id: 'history',      label: 'History',   path: '/history'      },
];

const StudentView: React.FC = () => {
  const navigate = useNavigate();
  const { generatedTimetable, institutionData } = useOnboardingStore();
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadFormat, setDownloadFormat]   = useState<'excel' | 'pdf'>('excel');

  const openDownload = (fmt: 'excel' | 'pdf') => {
    setDownloadFormat(fmt);
    setShowDownloadModal(true);
  };

  if (!generatedTimetable) {
    return (
      <div className="screen-enter p-8 max-w-2xl mx-auto text-center py-24">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: 'var(--paper-2)' }}>
          <Icon name="users" size={28} style={{ color: 'var(--ink-3)' } as React.CSSProperties} />
        </div>
        <h2 className="serif text-4xl tracking-tight mb-2">No timetable yet</h2>
        <p className="text-sm mb-8" style={{ color: 'var(--ink-3)' }}>Generate a timetable first.</p>
        <Btn variant="primary" size="md" onClick={() => navigate('/wizard')}>Start wizard</Btn>
      </div>
    );
  }

  const { assignments = [], working_days = [], time_slots = [], stats = {} }: any = generatedTimetable;
  const classes: string[] = [...new Set((assignments as any[]).map((a: any) => a.class_name))].sort() as string[];
  const allSubjects: string[] = [...new Set((assignments as any[]).map((a: any) => a.subject_code))] as string[];
  const subjectColor: Record<string, string> = {};
  allSubjects.forEach((c, i) => { subjectColor[c] = PALETTE[i % PALETTE.length]; });

  const [selectedClass, setSelectedClass] = useState<string>(classes[0] || '');
  const periods = (time_slots as any[]).map((s: any, i: number) => ({ period: i + 1, ...s }));

  const grid: Record<string, Record<number, any>> = {};
  (working_days as string[]).forEach(d => { grid[d] = {}; });
  (assignments as any[]).filter((a: any) => a.class_name === selectedClass).forEach((a: any) => {
    if (!grid[a.day]) grid[a.day] = {};
    grid[a.day][a.period] = a;
  });


  return (
    <div className="screen-enter">
      <TopBar
        title="Student view"
        crumbs={[institutionData?.name || 'School', selectedClass]}
        actions={
          <>
            <Btn variant="ghost" size="sm" onClick={() => openDownload('excel')}>
              <Icon name="dl" size={13} /> Excel
            </Btn>
            <Btn variant="ghost" size="sm" onClick={() => openDownload('pdf')}>
              <Icon name="file" size={13} /> PDF
            </Btn>
          </>
        }
      />

      <div className="p-8 max-w-[1400px] mx-auto">
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

        {/* Class selector */}
        {classes.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {classes.map(cls => (
              <button key={cls} onClick={() => setSelectedClass(cls)}
                className="px-3 py-1 rounded-full text-sm font-medium transition-colors"
                style={{
                  background: selectedClass === cls ? 'var(--ink)' : 'var(--paper)',
                  color: selectedClass === cls ? 'var(--paper)' : 'var(--ink-2)',
                  border: `1px solid ${selectedClass === cls ? 'var(--ink)' : 'var(--line)'}`,
                }}>
                {cls}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        <div className="edge rounded-xl overflow-hidden mb-6" style={{ background: 'var(--paper)' }}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
                  <th className="px-4 py-3 text-left text-[11px] mono font-medium w-28">Period</th>
                  {(working_days as string[]).map(day => (
                    <th key={day} className="px-3 py-3 text-center text-[11px] mono font-medium">
                      {day.slice(0, 3).toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((slot: any, pi: number) => (
                  <tr key={pi} style={{ borderTop: '1px solid var(--line)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td className="px-4 py-2" style={{ borderRight: '1px solid var(--line)' }}>
                      <div className="text-[11px] font-semibold">P{slot.period}</div>
                      <div className="text-[10px] mono" style={{ color: 'var(--ink-3)' }}>{slot.start}–{slot.end}</div>
                    </td>
                    {(working_days as string[]).map(day => {
                      const a = grid[day]?.[slot.period];
                      return (
                        <td key={day} className="px-2 py-2 text-center" style={{ borderRight: '1px solid var(--line)' }}>
                          {a ? (
                            <div className="rounded-lg px-2 py-1.5 text-left"
                              style={{ background: subjectColor[a.subject_code] + '18', border: `1px solid ${subjectColor[a.subject_code]}33` }}>
                              <div className="text-[11px] font-semibold" style={{ color: subjectColor[a.subject_code] }}>
                                {a.subject_code}
                              </div>
                              <div className="text-[10px]" style={{ color: 'var(--ink-2)' }}>{a.teacher_name}</div>
                              <div className="text-[10px]" style={{ color: 'var(--ink-3)' }}>{a.room_name}</div>
                            </div>
                          ) : (
                            <div className="text-[11px]" style={{ color: 'var(--line)' }}>—</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Download modal */}
      {showDownloadModal && (
        <DownloadModal
          format={downloadFormat}
          onClose={() => setShowDownloadModal(false)}
          timetableData={generatedTimetable}
          institutionName={institutionData?.name || 'Timetable'}
        />
      )}
    </div>
  );
};

export default StudentView;
