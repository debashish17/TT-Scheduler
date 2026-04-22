import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboardingStore } from '../../store';
import { Btn, Eyebrow, Chip, Icon, TopBar } from '../ui/primitives';
import toast from 'react-hot-toast';
import { exportAllViewsToExcel, exportSelectedPDFs } from '../../utils/exportHelpers';
import ExportModal from './ExportModal';

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

const FacultyView: React.FC = () => {
  const navigate = useNavigate();
  const { generatedTimetable, setGeneratedTimetable, institutionData } = useOnboardingStore();
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [editingTeacher, setEditingTeacher] = useState<{ old: string } | null>(null);
  const [editName, setEditName] = useState('');
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
  const allSubjects: string[] = [...new Set((assignments as any[]).map((a: any) => a.subject_code))] as string[];
  const subjectColor: Record<string, string> = {};
  allSubjects.forEach((c, i) => { subjectColor[c] = PALETTE[i % PALETTE.length]; });

  const teachers: string[] = [...new Set((assignments as any[]).map((a: any) => a.teacher_name))].sort() as string[];
  const [selectedTeacher, setSelectedTeacher] = useState<string>(teachers[0] || '');
  const periods = (time_slots as any[]).map((s: any, i: number) => ({ period: i + 1, ...s }));

  const teacherAssignments = (assignments as any[]).filter((a: any) => a.teacher_name === selectedTeacher);
  const grid: Record<string, Record<number, any>> = {};
  (working_days as string[]).forEach(d => { grid[d] = {}; });
  teacherAssignments.forEach((a: any) => { if (!grid[a.day]) grid[a.day] = {}; grid[a.day][a.period] = a; });

  const handleRename = (newName: string) => {
    if (!newName || newName === editingTeacher?.old) { setEditingTeacher(null); return; }
    const updated = (assignments as any[]).map((a: any) =>
      a.teacher_name === editingTeacher?.old ? { ...a, teacher_name: newName } : a
    );
    setGeneratedTimetable({ ...generatedTimetable, assignments: updated });
    if (selectedTeacher === editingTeacher?.old) setSelectedTeacher(newName);
    setEditingTeacher(null);
    toast.success(`Renamed to ${newName}`);
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    const tid = toast.loading('Generating Excel Sheets…');
    try {
      exportAllViewsToExcel(institutionData?.name || 'Timetable', assignments, working_days, time_slots);
      toast.success('Downloaded!', { id: tid });
    } catch { toast.error('Export failed', { id: tid }); } finally { setExportingExcel(false); }
  };

  const handleExportPdf = async (selections: any) => {
    setIsPdfModalOpen(false);
    setExportingPdf(true);
    const tid = toast.loading('Generating PDFs…');
    try {
      await exportSelectedPDFs(institutionData?.name || 'Timetable', selections, assignments, working_days, time_slots);
      toast.success('Downloaded!', { id: tid });
    } catch {
      toast.error('Failed to generate PDF archive', { id: tid });
    } finally { setExportingPdf(false); }
  };

  return (
    <div className="screen-enter">
      <TopBar
        title="Faculty"
        crumbs={[institutionData?.name || 'School', 'Faculty view']}
        actions={
          <>
            <Btn variant="ghost" size="sm" onClick={handleExportExcel} disabled={exportingExcel}>
              <Icon name="dl" size={13} /> {exportingExcel ? 'Exporting…' : 'Excel'}
            </Btn>
            <Btn variant="ghost" size="sm" onClick={() => setIsPdfModalOpen(true)} disabled={exportingPdf}>
              <Icon name="file" size={13} /> {exportingPdf ? 'Exporting…' : 'PDF'}
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

        {/* View mode toggle + stats */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1 edge rounded-full p-1" style={{ background: 'var(--paper)' }}>
            <button onClick={() => setViewMode('grid')}
              className="px-4 py-1.5 rounded-full text-sm font-medium"
              style={{ background: viewMode === 'grid' ? 'var(--ink)' : 'transparent', color: viewMode === 'grid' ? 'var(--paper)' : 'var(--ink-3)' }}>
              By teacher
            </button>
            <button onClick={() => setViewMode('list')}
              className="px-4 py-1.5 rounded-full text-sm font-medium"
              style={{ background: viewMode === 'list' ? 'var(--ink)' : 'transparent', color: viewMode === 'list' ? 'var(--paper)' : 'var(--ink-3)' }}>
              By subject
            </button>
          </div>
          <span className="mono text-[12px]" style={{ color: 'var(--ink-3)' }}>
            {teachers.length} teachers · {(assignments as any[]).length} assignments
          </span>
        </div>

        {viewMode === 'grid' ? (
          <>
            {/* Teacher selector */}
            <div className="edge rounded-xl p-4 mb-6" style={{ background: 'var(--paper)' }}>
              <Eyebrow className="block mb-3">Select teacher</Eyebrow>
              <div className="flex flex-wrap gap-2 mb-4">
                {teachers.map(t => (
                  <button key={t} onClick={() => setSelectedTeacher(t)}
                    className="px-3 py-1 rounded-full text-sm font-medium transition-colors"
                    style={{
                      background: selectedTeacher === t ? 'var(--ink)' : 'var(--paper-2)',
                      color: selectedTeacher === t ? 'var(--paper)' : 'var(--ink-2)',
                    }}>
                    {t}
                  </button>
                ))}
              </div>
              {selectedTeacher && (
                <div className="flex flex-wrap gap-6 pt-3 text-sm" style={{ borderTop: '1px solid var(--line)' }}>
                  <div>
                    <span style={{ color: 'var(--ink-3)' }}>Periods/week </span>
                    <strong>{teacherAssignments.length}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--ink-3)' }}>Subjects </span>
                    <strong>{[...new Set(teacherAssignments.map((a: any) => a.subject_code))].join(', ')}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--ink-3)' }}>Classes </span>
                    <strong>{[...new Set(teacherAssignments.map((a: any) => a.class_name))].join(', ')}</strong>
                  </div>
                  <button className="ml-auto text-[12px] underline underline-offset-4"
                    style={{ color: 'var(--ink-3)' }}
                    onClick={() => { setEditingTeacher({ old: selectedTeacher }); setEditName(selectedTeacher); }}>
                    Rename
                  </button>
                </div>
              )}
              {editingTeacher && (
                <div className="flex items-center gap-2 mt-3">
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRename(editName)}
                    className="px-3 py-2 rounded-md text-sm flex-1 outline-none"
                    style={{ background: 'var(--paper)', border: '1px solid var(--ink)', color: 'var(--ink)' }}
                  />
                  <Btn variant="primary" size="sm" onClick={() => handleRename(editName)}>Save</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => setEditingTeacher(null)}>Cancel</Btn>
                </div>
              )}
            </div>

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
                                  <div className="text-[10px]" style={{ color: 'var(--ink-2)' }}>{a.class_name}</div>
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
          </>
        ) : (
          /* By-subject list */
          <div className="space-y-4">
            {allSubjects.map((subject: string) => {
              const sa = (assignments as any[]).filter((a: any) => a.subject_code === subject);
              const teaches = [...new Set(sa.map((a: any) => a.teacher_name))] as string[];
              return (
                <div key={subject} className="edge rounded-xl p-5" style={{ background: 'var(--paper)' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="mono text-[11px] px-2.5 py-1 rounded-full font-semibold"
                      style={{ background: subjectColor[subject] + '18', color: subjectColor[subject] }}>
                      {subject}
                    </span>
                    <span className="text-sm font-medium">{sa[0]?.subject_name || subject}</span>
                    <span className="mono text-[11px] ml-auto" style={{ color: 'var(--ink-3)' }}>
                      {sa.length} periods/week
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {teaches.map(teacher => {
                      const count = sa.filter((a: any) => a.teacher_name === teacher).length;
                      return (
                        <div key={teacher} className="flex items-center justify-between p-3 rounded-lg"
                          style={{ background: 'var(--paper-2)', border: '1px solid var(--line)' }}>
                          <div>
                            <div className="text-sm font-medium">{teacher}</div>
                            <div className="text-[11px] mono" style={{ color: 'var(--ink-3)' }}>
                              {count} period{count !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`@media print { body*{visibility:hidden} .screen-enter,.screen-enter *{visibility:visible} .screen-enter{position:absolute;left:0;top:0;width:100%} }`}</style>
      <ExportModal isOpen={isPdfModalOpen} onClose={() => setIsPdfModalOpen(false)} onExport={handleExportPdf} />
    </div>
  );
};

export default FacultyView;
