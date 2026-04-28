import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WizardState {
  workflow: 'school' | 'college' | null;
  setWorkflow: (w: 'school' | 'college') => void;
  reset: () => void;
}

export const useWizardStore = create<WizardState>()(
  persist(
    (set) => ({
      workflow: null,
      setWorkflow: (w) => set({ workflow: w }),
      reset: () => set({ workflow: null }),
    }),
    { name: 'wizard-workflow' }
  )
);
