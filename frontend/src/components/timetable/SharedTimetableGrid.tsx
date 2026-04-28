import React from 'react';

export const PALETTE = [
  '#0369A1', '#0F766E', '#7C3AED', '#B45309',
  '#BE185D', '#065F46', '#1D4ED8', '#9D174D',
];

export function buildSubjectColor(codes: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  codes.forEach((c, i) => { map[c] = PALETTE[i % PALETTE.length]; });
  return map;
}

// ─── Cell variants ────────────────────────────────────────────────────────────

interface SlotHeaderProps {
  slot: { period: number; start: string; end: string };
  lunchPeriod: number;
}

export const SlotHeader: React.FC<SlotHeaderProps> = ({ slot, lunchPeriod }) => {
  const isLunch = slot.period === lunchPeriod;
  return (
    <th scope="col" className="px-3 py-3 text-center"
      style={{
        borderRight: '1px solid rgba(255,255,255,0.1)',
        minWidth: 120,
        background: isLunch ? 'rgba(255,255,255,0.08)' : undefined,
      }}>
      {isLunch ? (
        <div className="text-[11px] font-semibold opacity-70">LUNCH</div>
      ) : (
        <>
          <div className="text-[12px] font-semibold">P{slot.period}</div>
          <div className="text-[10px] mono opacity-70">{slot.start}–{slot.end}</div>
        </>
      )}
    </th>
  );
};

interface LunchCellProps {
  slot: { start: string; end: string };
  rowSpan?: number;
}

export const LunchCell: React.FC<LunchCellProps> = ({ slot, rowSpan }) => (
  <td rowSpan={rowSpan} style={{
    borderRight: '1px solid var(--line)',
    background: 'var(--paper-2)',
    minWidth: 120,
    verticalAlign: 'middle',
    padding: '6px 10px',
    textAlign: 'center',
  }}>
    <div className="text-[11px] mono font-semibold" style={{ color: 'var(--ink-3)' }}>LUNCH</div>
    <div className="text-[10px] mono" style={{ color: 'var(--ink-3)', opacity: 0.6 }}>{slot.start}–{slot.end}</div>
  </td>
);

// ─── School cell (one assignment per slot) ────────────────────────────────────

interface SchoolCellProps {
  assignment: any;
  subjectColor: Record<string, string>;
  /** Which secondary line to show: teacher name (class/student view) or class name (faculty view) */
  secondaryField: 'teacher_name' | 'class_name';
}

export const SchoolCell: React.FC<SchoolCellProps> = ({ assignment, subjectColor, secondaryField }) => {
  if (!assignment) return (
    <td style={{ borderRight: '1px solid var(--line)', minWidth: 120, verticalAlign: 'middle', textAlign: 'center' }}>
      <div className="text-[12px]" style={{ color: 'var(--line)' }}>—</div>
    </td>
  );
  const color = subjectColor[assignment.subject_code];
  return (
    <td className="px-2 py-2" style={{ borderRight: '1px solid var(--line)', verticalAlign: 'top', minWidth: 120 }}>
      <div className="rounded-lg px-2 py-2"
        style={{ background: color + '18', border: `1px solid ${color}33`, minHeight: 54 }}>
        <div className="text-[12px] font-semibold leading-tight" style={{ color }}>{assignment.subject_code}</div>
        <div className="text-[11px] leading-snug truncate mt-0.5" style={{ color: 'var(--ink-2)' }}>
          {assignment[secondaryField]}
        </div>
        <div className="text-[10px] leading-snug truncate" style={{ color: 'var(--ink-3)' }}>{assignment.room_name}</div>
      </div>
    </td>
  );
};

// ─── College cell (theory + lab rows) ────────────────────────────────────────

interface CollegeCellProps {
  entries: any[];
  codeColor: Record<string, string>;
  rowType: 'theory' | 'lab';
}

export const CollegeCell: React.FC<CollegeCellProps> = ({ entries, codeColor, rowType }) => {
  if (entries.length === 0) return (
    <td style={{ borderRight: '1px solid var(--line)', minWidth: 120, verticalAlign: 'middle', textAlign: 'center' }}>
      <div className="text-[11px]" style={{ color: 'var(--line)' }}>—</div>
    </td>
  );
  return (
    <td className="px-1.5 py-1.5" style={{ borderRight: '1px solid var(--line)', verticalAlign: 'top', minWidth: 120 }}>
      <div className="flex flex-col gap-1">
        {entries.map((a: any, i: number) => {
          const color = codeColor[a.subject_code];
          const alpha = rowType === 'lab' ? '14' : '18';
          const border = rowType === 'lab' ? '28' : '33';
          return (
            <div key={i} className="rounded px-1.5 py-1.5"
              style={{ background: color + alpha, border: `1px solid ${color}${border}` }}>
              <div className="text-[10px] font-semibold leading-tight" style={{ color }}>
                {a.section_label ? `Sec ${a.section_label}` : a.subject_code}
              </div>
              <div className="text-[10px] leading-snug truncate" style={{ color: 'var(--ink-2)' }}>{a.teacher_name}</div>
              <div className="text-[10px] leading-snug" style={{ color: 'var(--ink-3)' }}>{a.room_name}</div>
            </div>
          );
        })}
      </div>
    </td>
  );
};

// ─── Day header cell ──────────────────────────────────────────────────────────

interface DayHeaderCellProps {
  day: string;
  rowSpan?: number;
}

export const DayHeaderCell: React.FC<DayHeaderCellProps> = ({ day, rowSpan }) => (
  <th scope="row" rowSpan={rowSpan}
    className="px-3 py-2 text-[12px] font-bold mono text-center"
    style={{
      borderRight: '1px solid var(--line)',
      background: 'var(--paper-2)',
      verticalAlign: 'middle',
      whiteSpace: 'nowrap',
      fontWeight: 700,
    }}>
    {day.slice(0, 3).toUpperCase()}
  </th>
);

// ─── Period row header (for period-as-column layout the "Day" column is the row header) ─
// Used in class/student views where orientation is periods=columns, days=rows.
// The period header is the first column in that case — nothing needed as a separate component.

// ─── Legend ───────────────────────────────────────────────────────────────────

interface LegendProps {
  codes: string[];
  codeColor: Record<string, string>;
  assignments: any[];
}

export const Legend: React.FC<LegendProps> = ({ codes, codeColor, assignments }) => (
  <div className="px-5 py-3 flex flex-wrap gap-2"
    style={{ borderTop: '1px solid var(--line)', background: 'var(--paper-2)' }}>
    {codes.map(code => {
      const subj = assignments.find((a: any) => a.subject_code === code);
      return (
        <span key={code} className="px-2.5 py-1 rounded-full text-[11px] font-medium"
          style={{ background: codeColor[code] + '18', color: codeColor[code], border: `1px solid ${codeColor[code]}33` }}>
          {code}{subj?.subject_name ? ` — ${subj.subject_name}` : ''}
        </span>
      );
    })}
  </div>
);

// ─── School timetable table (periods = columns, days = rows) ──────────────────

interface SchoolTableProps {
  assignments: any[];
  working_days: string[];
  periods: Array<{ period: number; start: string; end: string }>;
  lunchPeriod: number;
  subjectColor: Record<string, string>;
  secondaryField: 'teacher_name' | 'class_name';
}

export const SchoolTable: React.FC<SchoolTableProps> = ({
  assignments, working_days, periods, lunchPeriod, subjectColor, secondaryField,
}) => {
  const grid: Record<string, Record<number, any>> = {};
  working_days.forEach(d => { grid[d] = {}; });
  assignments.forEach((a: any) => {
    if (!grid[a.day]) grid[a.day] = {};
    grid[a.day][a.period] = a;
  });

  return (
    <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 700 }}>
      <colgroup>
        <col style={{ width: 72 }} />
        {periods.map(slot => (
          <col key={slot.period} style={{ width: slot.period === lunchPeriod ? 100 : undefined }} />
        ))}
      </colgroup>
      <thead>
        <tr style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
          <th scope="col" className="px-3 py-3 text-[11px] mono font-medium text-left"
            style={{ borderRight: '1px solid rgba(255,255,255,0.1)' }}>
            Day
          </th>
          {periods.map(slot => <SlotHeader key={slot.period} slot={slot} lunchPeriod={lunchPeriod} />)}
        </tr>
      </thead>
      <tbody>
        {working_days.map(day => (
          <tr key={day} style={{ borderTop: '2px solid var(--line)' }}>
            <DayHeaderCell day={day} />
            {periods.map(slot => {
              if (slot.period === lunchPeriod) return <LunchCell key={slot.period} slot={slot} />;
              return (
                <SchoolCell
                  key={slot.period}
                  assignment={grid[day]?.[slot.period]}
                  subjectColor={subjectColor}
                  secondaryField={secondaryField}
                />
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// ─── College timetable table (periods = columns, days = rows, theory+lab) ─────

type CollegeCellData = { lecture: any[]; lab: any[] };

interface CollegeTableProps {
  assignments: any[];
  working_days: string[];
  periods: Array<{ period: number; start: string; end: string }>;
  lunchPeriod: number;
  codeColor: Record<string, string>;
  hasLab: boolean;
}

export const CollegeTable: React.FC<CollegeTableProps> = ({
  assignments, working_days, periods, lunchPeriod, codeColor, hasLab,
}) => {
  const grid: Record<string, Record<number, CollegeCellData>> = {};
  working_days.forEach(day => {
    grid[day] = {};
    periods.forEach(s => { grid[day][s.period] = { lecture: [], lab: [] }; });
  });
  assignments.forEach((a: any) => {
    if (!grid[a.day]?.[a.period]) return;
    if (a.course_type === 'lab') grid[a.day][a.period].lab.push(a);
    else grid[a.day][a.period].lecture.push(a);
  });

  return (
    <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 700 }}>
      <colgroup>
        <col style={{ width: 64 }} />
        {hasLab && <col style={{ width: 68 }} />}
        {periods.map(slot => (
          <col key={slot.period} style={{ width: slot.period === lunchPeriod ? 100 : undefined }} />
        ))}
      </colgroup>
      <thead>
        <tr style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
          <th scope="col" className="px-3 py-3 text-[11px] mono font-medium text-left"
            style={{ borderRight: '1px solid rgba(255,255,255,0.1)' }}>
            Day
          </th>
          {hasLab && (
            <th scope="col" className="px-2 py-3 text-[10px] mono font-medium text-center"
              style={{ borderRight: '1px solid rgba(255,255,255,0.1)' }}>
              Type
            </th>
          )}
          {periods.map(slot => <SlotHeader key={slot.period} slot={slot} lunchPeriod={lunchPeriod} />)}
        </tr>
      </thead>
      <tbody>
        {working_days.map(day => (
          <React.Fragment key={day}>
            <tr style={{ borderTop: '2px solid var(--line)' }}>
              <DayHeaderCell day={day} rowSpan={hasLab ? 2 : 1} />
              {hasLab && (
                <td className="px-2 py-1.5 text-[10px] mono font-semibold text-center"
                  style={{ background: 'rgba(59,130,246,0.06)', borderRight: '1px solid var(--line)', color: '#1D4ED8' }}>
                  THEORY
                </td>
              )}
              {periods.map(slot => {
                if (slot.period === lunchPeriod) return <LunchCell key={slot.period} slot={slot} rowSpan={hasLab ? 2 : 1} />;
                return (
                  <CollegeCell
                    key={slot.period}
                    entries={grid[day]?.[slot.period]?.lecture ?? []}
                    codeColor={codeColor}
                    rowType="theory"
                  />
                );
              })}
            </tr>
            {hasLab && (
              <tr style={{ borderTop: '1px dashed var(--line)' }}>
                <td className="px-2 py-1.5 text-[10px] mono font-semibold text-center"
                  style={{ background: 'rgba(5,150,105,0.06)', borderRight: '1px solid var(--line)', color: '#065F46' }}>
                  LAB
                </td>
                {periods.map(slot => {
                  if (slot.period === lunchPeriod) return null;
                  return (
                    <CollegeCell
                      key={slot.period}
                      entries={grid[day]?.[slot.period]?.lab ?? []}
                      codeColor={codeColor}
                      rowType="lab"
                    />
                  );
                })}
              </tr>
            )}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  );
};
