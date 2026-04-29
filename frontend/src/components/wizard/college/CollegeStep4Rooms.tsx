import React, { useState } from 'react';
import { WizardShell } from '../WizardShell';
import { useWizardStore } from '../wizardStore';
import { useOnboardingStore } from '../../../store';
import { Btn, Icon } from '../../ui/primitives';

/* ── Mini primitives ── */
const TInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...props }) => (
  <input {...props} className={`w-full px-2 py-1.5 rounded text-sm outline-none ${className}`}
    style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}
    onFocus={e => (e.target.style.borderColor = 'var(--ink)')}
    onBlur={e => (e.target.style.borderColor = 'var(--line)')} />
);

const TSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ children, ...rest }) => (
  <select {...rest} className="w-full px-2 py-1.5 rounded text-sm outline-none"
    style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}>
    {children}
  </select>
);

/* ── Types ── */
interface RoomRow {
  name: string;
  capacity: number;
  room_type: string;
}

const ROOM_TYPES = [
  'classroom',
  'lecture_hall',
  'computer_lab',
  'physics_lab',
  'chemistry_lab',
  'seminar_room',
];

const DEFAULT_ROWS: RoomRow[] = [
  { name: 'Lecture Hall A', capacity: 80, room_type: 'lecture_hall' },
  { name: 'Lecture Hall B', capacity: 75, room_type: 'lecture_hall' },
  { name: 'Lecture Hall C', capacity: 65, room_type: 'lecture_hall' },
  { name: 'CS Lab 1',       capacity: 60, room_type: 'computer_lab' },
  { name: 'CS Lab 2',       capacity: 60, room_type: 'computer_lab' },
];

/* ── Component ── */
const CollegeStep4Rooms: React.FC = () => {
  const { workflow } = useWizardStore();
  const { collegeRooms, setCollegeRooms } = useOnboardingStore();

  const [rows, setRows] = useState<RoomRow[]>(() => {
    if (!collegeRooms?.length) {
      setTimeout(() => setCollegeRooms(DEFAULT_ROWS), 0);
      return DEFAULT_ROWS;
    }
    return collegeRooms.map(r => ({ ...r }));
  });

  const update = (next: RoomRow[]) => {
    setRows(next);
    setCollegeRooms(next);
  };

  const updateRow = (index: number, patch: Partial<RoomRow>) => {
    update(rows.map((r, i) => i === index ? { ...r, ...patch } : r));
  };

  const addRow = () => {
    update([...rows, { name: '', capacity: 30, room_type: 'classroom' }]);
  };

  const removeRow = (index: number) => {
    update(rows.filter((_, i) => i !== index));
  };

  return (
    <WizardShell step={5} title="Rooms">
      <p className="text-sm mb-3" style={{ color: 'var(--ink-3)' }}>
        Define the rooms available for scheduling.
      </p>

      {/* Helper text */}
      <div className="rounded-md px-3 py-2 mb-5 text-[12px]"
        style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
        The solver picks rooms automatically. Add enough rooms to cover enrolled students per course.
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--line)' }}>
        {/* Header */}
        <div className="grid grid-cols-[2fr_100px_160px_40px] gap-3 px-4 py-2"
          style={{ background: 'var(--paper-2)', borderBottom: '1px solid var(--line)' }}>
          {['Room name', 'Capacity', 'Room type', ''].map(h => (
            <span key={h} className="text-[11px] font-semibold" style={{ color: 'var(--ink-3)' }}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        {rows.map((row, i) => (
          <div
            key={i}
            className="grid grid-cols-[2fr_100px_160px_40px] gap-3 items-center px-4 py-2"
            style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--line)' : undefined }}
          >
            {/* Name */}
            <TInput
              value={row.name}
              placeholder="e.g. Lecture Hall 1"
              onChange={e => updateRow(i, { name: e.target.value })}
            />
            {/* Capacity */}
            <TInput
              type="number"
              min={1}
              value={row.capacity}
              onChange={e => updateRow(i, { capacity: Math.max(1, Number(e.target.value)) })}
            />
            {/* Room type */}
            <TSelect
              value={row.room_type}
              onChange={e => updateRow(i, { room_type: e.target.value })}
            >
              {ROOM_TYPES.map(t => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </TSelect>
            {/* Delete */}
            <button
              onClick={() => removeRow(i)}
              className="flex items-center justify-center w-7 h-7 rounded"
              style={{ color: 'var(--err)', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>

      {rows.length === 0 && (
        <p className="text-sm text-center py-6" style={{ color: 'var(--ink-3)' }}>
          No rooms yet. Add your first room below.
        </p>
      )}

      <div className="mt-4">
        <Btn variant="ghost" size="sm" onClick={addRow}>
          <Icon name="plus" size={14} /> Add room
        </Btn>
      </div>
    </WizardShell>
  );
};

export default CollegeStep4Rooms;
