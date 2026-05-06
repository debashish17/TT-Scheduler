import React, { useState, useEffect } from 'react';
import { Btn, Icon } from '../ui/primitives';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (selections: { class: boolean; faculty: boolean; student: boolean; room: boolean }) => void;
}

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, onExport }) => {
  const [selections, setSelections] = useState({
    class: true,
    faculty: true,
    student: false,
    room: false,
  });

  // Scroll the page to the top when the modal opens, so the modal (anchored
  // near the viewport top via pt-[10vh]) is always visible regardless of
  // where the user was scrolled on the underlying page.
  useEffect(() => {
    if (isOpen) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] pb-8 px-4 overflow-y-auto bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200" style={{ background: 'var(--paper)', border: '1px solid var(--line)' }}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--line)' }}>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Icon name="file" size={18} />
            Download PDFs
          </h2>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        
        <div className="p-5">
          <p className="text-sm mb-4" style={{ color: 'var(--ink-3)' }}>
            Select the timetable views you want to download. Multiple views will be archived into a single .zip file.
          </p>
          
          <div className="space-y-3">
            {[
              { id: 'class', label: 'Class View', desc: 'Timetables organized by class' },
              { id: 'faculty', label: 'Faculty View', desc: 'Timetables organized by teacher' },
              { id: 'student', label: 'Student View', desc: 'Individual student schedules' },
              { id: 'room', label: 'Room View', desc: 'Schedules grouped by room' },
            ].map(view => (
              <label key={view.id} className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors" style={{ borderColor: selections[view.id as keyof typeof selections] ? 'var(--brand)' : 'var(--line)', background: selections[view.id as keyof typeof selections] ? 'var(--brand-light, #EFF6FF)' : 'transparent' }}>
                <div className="mt-0.5">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={selections[view.id as keyof typeof selections]}
                    onChange={(e) => setSelections(prev => ({ ...prev, [view.id]: e.target.checked }))}
                  />
                </div>
                <div>
                  <div className="font-medium text-sm">{view.label}</div>
                  <div className="text-xs" style={{ color: 'var(--ink-3)' }}>{view.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
        
        <div className="p-4 border-t flex items-center justify-end gap-2" style={{ borderColor: 'var(--line)', background: 'var(--paper-2)' }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn 
            variant="brand" 
            disabled={!Object.values(selections).some(Boolean)}
            onClick={() => onExport(selections)}
          >
            Export Selected
          </Btn>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
