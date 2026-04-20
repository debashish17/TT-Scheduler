import React, { useState } from 'react';
import { WizardShell } from './WizardShell';
import { useWizardStore } from './wizardStore';
import { useOnboardingStore } from '../../../store';
import { Btn, Chip, Icon } from '../../ui/primitives';

interface Room { name: string; capacity: number; type: string }

const DEFAULT_SCHOOL: Room[] = [
  { name: 'Room 101',     capacity: 42, type: 'Classroom' },
  { name: 'Room 102',     capacity: 40, type: 'Classroom' },
  { name: 'Room 103',     capacity: 44, type: 'Classroom' },
  { name: 'Room 104',     capacity: 38, type: 'Classroom' },
  { name: 'Computer Lab', capacity: 30, type: 'Computer Lab' },
];

const DEFAULT_COLLEGE: Room[] = [
  { name: 'A-101', capacity: 60,  type: 'Lecture Hall'  },
  { name: 'A-104', capacity: 40,  type: 'Seminar Hall'  },
  { name: 'B-108', capacity: 80,  type: 'Lecture Hall'  },
  { name: 'B-204', capacity: 80,  type: 'Lecture Hall'  },
  { name: 'C-301', capacity: 120, type: 'Lecture Hall'  },
  { name: 'Lab-1', capacity: 30,  type: 'Computer Lab'  },
  { name: 'Lab-2', capacity: 30,  type: 'Computer Lab'  },
];

const ROOM_TYPES = ['Classroom', 'Lecture Hall', 'Computer Lab', 'Science Lab', 'Seminar Hall', 'Auditorium'];

const kindTone = (k: string): any =>
  k.includes('Lab') ? 'brand' : k.includes('Seminar') || k.includes('Auditorium') ? 'warn' : 'neutral';

const TInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { style?: React.CSSProperties }> = ({ style, ...props }) => (
  <input {...props} className="w-full px-2 py-1.5 rounded text-sm outline-none"
    style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink)', ...style }}
    onFocus={e => (e.target.style.borderColor = 'var(--ink)')}
    onBlur={e => (e.target.style.borderColor = 'var(--line)')} />
);

const TSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ children, ...rest }) => (
  <select {...rest} className="w-full px-2 py-1.5 rounded text-sm outline-none"
    style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}>
    {children}
  </select>
);

const Step6Rooms: React.FC = () => {
  const { workflow } = useWizardStore();
  const { roomsData, setRoomsData } = useOnboardingStore();
  const isSchool = workflow === 'school';

  const defaults = isSchool ? DEFAULT_SCHOOL : DEFAULT_COLLEGE;
  const [rooms, setRooms] = useState<Room[]>(() => {
    // No data, use defaults and persist them immediately
    if (!roomsData?.length) {
      setTimeout(() => setRoomsData(defaults), 0);
      return defaults;
    }
    
    // Check if existing data matches current workflow by examining room types
    const SCHOOL_TYPES = new Set(['Classroom', 'Computer Lab']);
    const COLLEGE_TYPES = new Set(['Lecture Hall', 'Seminar Hall', 'Computer Lab']);
    
    const hasSchoolTypes = roomsData.some((r: any) => SCHOOL_TYPES.has(r.type));
    const hasCollegeTypes = roomsData.some((r: any) => COLLEGE_TYPES.has(r.type));
    
    // If data doesn't match workflow, reload defaults
    const isCorrectWorkflow = isSchool ? hasSchoolTypes : hasCollegeTypes;
    if (!isCorrectWorkflow && (hasSchoolTypes || hasCollegeTypes)) {
      return defaults;
    }
    
    // Data matches workflow or is ambiguous, use it
    return roomsData.map((r: any) => ({ 
      name: r.name ?? '', 
      capacity: parseInt(r.capacity) || 0, 
      type: r.type ?? 'Classroom' 
    }));
  });

  const update = (i: number, field: keyof Room, value: string | number) => {
    const next = rooms.map((r, idx) => idx === i ? { ...r, [field]: value } : r);
    setRooms(next);
    setRoomsData(next);
  };

  const addRoom = () => {
    const next = [...rooms, { name: '', capacity: 40, type: 'Classroom' }];
    setRooms(next);
    setRoomsData(next);
  };

  const removeRoom = (i: number) => {
    const next = rooms.filter((_, idx) => idx !== i);
    setRooms(next);
    setRoomsData(next);
  };

  const labs   = rooms.filter(r => r.type.includes('Lab')).length;
  const maxCap = rooms.length > 0 ? Math.max(...rooms.map(r => Number(r.capacity) || 0)) : 0;

  return (
    <WizardShell step={6} title="Rooms">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
            {isSchool
              ? 'List classrooms and labs. Capacity is checked against class size.'
              : 'List all rooms by type. The solver matches courses to rooms by capacity and type.'}
          </p>
          <Btn variant="soft" size="sm"><Icon name="import" size={13} /> Import CSV</Btn>
        </div>

        <div className="edge rounded-lg overflow-hidden" style={{ background: 'var(--paper)' }}>
          <table className="w-full text-sm">
            <thead style={{ background: 'var(--paper-2)' }}>
              <tr style={{ color: 'var(--ink-3)' }}>
                <th className="py-2 px-4 text-left eyebrow font-medium">Room</th>
                <th className="py-2 px-4 text-left eyebrow font-medium w-28">Capacity</th>
                <th className="py-2 px-4 text-left eyebrow font-medium w-40">Type</th>
                <th className="py-2 px-4 w-10" />
              </tr>
            </thead>
            <tbody>
              {rooms.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--line)' }}>
                  <td className="py-2 px-4">
                    <TInput value={r.name} onChange={e => update(i, 'name', e.target.value)}
                      placeholder="e.g. Room 101" />
                  </td>
                  <td className="py-2 px-4">
                    <TInput type="number" value={r.capacity} min={1}
                      onChange={e => update(i, 'capacity', parseInt(e.target.value) || 0)}
                      style={{ width: 80 } as React.CSSProperties} />
                  </td>
                  <td className="py-2 px-4">
                    <TSelect value={r.type} onChange={e => update(i, 'type', e.target.value)}>
                      {ROOM_TYPES.map(t => <option key={t}>{t}</option>)}
                    </TSelect>
                  </td>
                  <td className="py-2 px-4">
                    <button onClick={() => removeRoom(i)} style={{ color: 'var(--ink-3)' }}>
                      <Icon name="x" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={addRoom}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm rounded-b-lg"
            style={{ color: 'var(--ink-3)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <Icon name="plus" size={13} /> Add room
          </button>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-0 edge rounded-lg overflow-hidden" style={{ background: 'var(--paper)' }}>
          {[
            { label: 'Total rooms',  v: rooms.length },
            { label: 'Labs',         v: labs },
            { label: 'Max capacity', v: maxCap },
          ].map((s, i) => (
            <div key={s.label} className="p-4" style={{ borderRight: i < 2 ? '1px solid var(--line)' : undefined }}>
              <div className="eyebrow mb-1" style={{ color: 'var(--ink-3)' }}>{s.label}</div>
              <div className="serif text-3xl">{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    </WizardShell>
  );
};

export default Step6Rooms;
