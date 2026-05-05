import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboardingStore } from '../../store';
import { useWizardStore } from '../wizard/wizardStore';
import { Btn, Icon } from '../ui/primitives';
import { apiClient } from '../../api/client';
import toast from 'react-hot-toast';

interface AIDraftModalProps {
  open: boolean;
  onClose: () => void;
}

const EXAMPLES = [
  'A high school with 3 classes (10A, 10B, 10C), 6 subjects (Math, English, Science, History, PE, Art), and 8 teachers. Mon–Fri, 7 periods per day starting at 8 AM.',
  'A college with 2 departments: CS (4 courses) and Math (3 courses), 10 faculty members, 5 classrooms and 2 labs. 6 periods per day.',
  'Primary school with 4 sections for Grade 5. Subjects: English, Hindi, Math, Science, Social Studies, Art. 6 periods/day, Mon–Sat.',
];

const AIDraftModal: React.FC<AIDraftModalProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    clearOnboardingData,
    setInstitutionData, setClassesData, setSubjectsData,
    setTeachersData, setTimeData, setRoomsData, setConstraintsData,
    setCollegeInstitution, setCourseOfferings, setCollegeFaculty,
    setCollegeRooms, setCollegeSchedule, setCollegeConstraints,
  } = useOnboardingStore();

  const handleDraft = async () => {
    if (!description.trim()) {
      toast.error('Please describe your timetable setup first');
      return;
    }
    setLoading(true);
    const tid = toast.loading('AI is drafting your setup…');
    try {
      const res = await apiClient.post(
        '/timetable/ai-draft',
        { description: description.trim() },
        { timeout: 60000 },
      );
      const data = res.data;
      const { institution_data } = data;
      const isCollege = institution_data?.type === 'college';

      // Wipe all stale wizard state before applying the new draft so old
      // college/school data from a previous run doesn't bleed through.
      clearOnboardingData();
      useWizardStore.getState().setWorkflow(isCollege ? 'college' : 'school');

      setInstitutionData(institution_data);

      if (isCollege) {
        if (data.college_institution)  setCollegeInstitution(data.college_institution);
        if (data.course_offerings)     setCourseOfferings(data.course_offerings);
        if (data.college_faculty)      setCollegeFaculty(data.college_faculty);
        if (data.college_rooms)        setCollegeRooms(data.college_rooms);
        if (data.college_schedule)     setCollegeSchedule(data.college_schedule);
        if (data.college_constraints)  setCollegeConstraints(data.college_constraints);
      } else {
        if (data.classes_data)      setClassesData(data.classes_data);
        if (data.subjects_data)     setSubjectsData(data.subjects_data);
        if (data.teachers_data)     setTeachersData(data.teachers_data);
        if (data.time_data)         setTimeData(data.time_data);
        if (data.rooms_data)        setRoomsData(data.rooms_data);
        if (data.constraints_data)  setConstraintsData(data.constraints_data);
      }

      toast.success('Draft ready — review and adjust in the wizard', { id: tid });
      onClose();
      navigate('/wizard/step/1');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      toast.error(detail || 'AI draft failed. Please try again.', { id: tid });
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-2xl shadow-2xl w-full max-w-[560px] mx-4 p-8"
        style={{ background: 'var(--paper)', color: 'var(--ink)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--brand-soft)' }}
            >
              <Icon name="sparkle" size={18} style={{ color: 'var(--brand)' } as React.CSSProperties} />
            </div>
            <div>
              <h2 className="serif text-3xl tracking-tight leading-none mb-1">AI draft</h2>
              <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
                Describe in plain English — we'll fill the wizard
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full transition-opacity hover:opacity-60"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Textarea */}
        <div className="mb-4">
          <label className="block text-[12px] font-medium mb-2" style={{ color: 'var(--ink-2)' }}>
            Describe your institution's timetable setup
          </label>
          <textarea
            rows={5}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. A high school with 4 classes (9A, 9B, 10A, 10B), 7 subjects, 10 teachers, and 5 classrooms. Classes run Mon–Fri, 7 periods per day starting at 8:00 AM."
            className="w-full px-3 py-2.5 rounded-md text-sm outline-none resize-none transition-colors"
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              color: 'var(--ink)',
              lineHeight: 1.6,
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--ink)')}
            onBlur={e  => (e.target.style.borderColor = 'var(--line)')}
          />
        </div>

        {/* Example prompts */}
        <div className="mb-6">
          <p className="text-[11px] mono mb-2" style={{ color: 'var(--ink-3)' }}>
            TRY AN EXAMPLE
          </p>
          <div className="space-y-1.5">
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                onClick={() => setDescription(ex)}
                className="w-full text-left px-3 py-2 rounded-lg text-[12px] transition-colors"
                style={{ background: 'var(--paper-2)', color: 'var(--ink-2)', lineHeight: 1.5 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--line)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--paper-2)')}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Btn
            variant="brand"
            size="sm"
            onClick={handleDraft}
            disabled={loading || !description.trim()}
            className="flex-1 justify-center"
          >
            <Icon name="sparkle" size={13} />
            {loading ? 'Generating draft…' : 'Generate draft'}
          </Btn>
          <Btn variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Btn>
        </div>

        <p className="mt-4 text-[11px] mono text-center" style={{ color: 'var(--ink-3)' }}>
          Powered by Claude Haiku · Results are fully editable in the wizard
        </p>
      </div>
    </div>
  );
};

export default AIDraftModal;
