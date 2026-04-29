import React from 'react';
import { useWizardStore } from './wizardStore';

import Step1Institution from './school/Step1Institution';
import Step2Classes from './school/Step2Classes';
import Step3Subjects from './school/Step3Subjects';
import Step4Teachers from './school/Step4Teachers';
import Step5Schedule from './school/Step5Schedule';
import Step6Rooms from './school/Step6Rooms';
import Step7Rules from './school/Step7Rules';

import CollegeStep1Institution from './college/CollegeStep1Institution';
import CollegeStep2CourseOfferings from './college/CollegeStep2CourseOfferings';
import CollegeStep3Faculty from './college/CollegeStep3Faculty';
import CollegeStep4Rooms from './college/CollegeStep4Rooms';
import CollegeStep5Schedule from './college/CollegeStep5Schedule';
import CollegeStep6Constraints from './college/CollegeStep6Constraints';
import CollegeStep7Generate from './college/CollegeStep7Generate';

const SCHOOL_STEPS = [
  Step1Institution,
  Step2Classes,
  Step3Subjects,
  Step4Teachers,
  Step5Schedule,
  Step6Rooms,
  Step7Rules,
];

const COLLEGE_STEPS = [
  CollegeStep1Institution,
  CollegeStep2CourseOfferings,
  CollegeStep3Faculty,
  CollegeStep5Schedule,
  CollegeStep4Rooms,
  CollegeStep6Constraints,
  CollegeStep7Generate,
];

interface Props {
  step: number; // 1-based
}

const WizardStep: React.FC<Props> = ({ step }) => {
  const { workflow } = useWizardStore();
  const steps = workflow === 'college' ? COLLEGE_STEPS : SCHOOL_STEPS;
  const Component = steps[step - 1];
  return Component ? <Component /> : null;
};

export default WizardStep;
