import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboardingStore } from '../../store';
import { Btn, Icon, TopBar } from '../ui/primitives';
import toast from 'react-hot-toast';
import { exportAllViewsToExcel, exportSelectedPDFs } from '../../utils/exportHelpers';
import ExportModal from './ExportModal';
import { buildSubjectColor, SchoolTable, Legend } from './SharedTimetableGrid';

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
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

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

  const { assignments = [], working_days = [], time_slots = [], lunch_period_index = -1 }: any = generatedTimetable;
  const lunchPeriod: number = lunch_period_index >= 0 ? lunch_period_index + 1 : -1;
  const allSubjects: string[] = [...new Set((assignments as any[]).map((a: any) => a.subject_code))] as string[];
  const subjectColor = buildSubjectColor(allSubjects);

  const classes: string[] = [...new Set((assignments as any[]).map((a: any) => a.class_name))].sort() as string[];
  const [selectedClass, setSelectedClass] = useState<string>(classes[0] || '');
  const periods = (time_slots as any[]).map((s: any, i: number) => ({ period: i + 1, ...s }));

  const classAssignments = (assignments as any[]).filter((a: any) => a.class_name === selectedClass);

  const handleExportExcel = async () => {
    setExportingExcel(true);
    const tid = toast.loading('Generating Excel Sheets…');
    try {
      exportAllViewsToExcel(institutionData?.name || 'Timetable', assignments, working_days, time_slots);
      toast.success('Downloaded!', { id: tid });
    } catch { toast.error('Export failed', { id: tid }); }
    finally { setExportingExcel(false); }
  };

  const handleExportPdf = async (selections: any) => {
    setIsPdfModalOpen(false);
    setExportingPdf(true);
    const tid = toast.loading('Generating PDFs…');
    try {
      await exportSelectedPDFs(institutionData?.name || 'Timetable', selections, assignments, working_days, time_slots);
      toast.success('Downloaded!', { id: tid });
    } catch { toast.error('Failed to generate PDF archive', { id: tid }); }
    finally { setExportingPdf(false); }
  };

  return (
    <div className="screen-enter">
      <TopBar
        title="Student view"
        crumbs={[institutionData?.name || 'School', selectedClass]}
        actions={
          <>
            <Btn variant="ghost" size="sm" onClick={handleExportExcel} disabled={exportingExcel}>
              <Icon name="dl" size={13} /> {exportingExcel ? 'Exporting…' : 'Excel'}
            </Btn>
            <Btn variant="ghost" size="sm" onClick={() => setIsPdfModalOpen(true)} disabled={exportingPdf}>
              <Icon name="file" size={13} /> {exportingPdf ? 'Exporting…' : 'PDF'}
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
            <SchoolTable
              assignments={classAssignments}
              working_days={working_days}
              periods={periods}
              lunchPeriod={lunchPeriod}
              subjectColor={subjectColor}
              secondaryField="teacher_name"
            />
          </div>
          <Legend codes={allSubjects} codeColor={subjectColor} assignments={assignments} />
        </div>
      </div>

      <style>{`@media print { body*{visibility:hidden} .screen-enter,.screen-enter *{visibility:visible} .screen-enter{position:absolute;left:0;top:0;width:100%} }`}</style>
      <ExportModal isOpen={isPdfModalOpen} onClose={() => setIsPdfModalOpen(false)} onExport={handleExportPdf} />
    </div>
  );
};

export default StudentView;
