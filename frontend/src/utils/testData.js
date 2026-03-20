/**
 * Auto-populate script for testing the onboarding flow
 * Run this in browser console to quickly fill all screens with test data
 */

// Test data sets
export const testData = {
  // Complete school data
  full: {
    institution: {
      name: 'Greenwood Elementary School',
      type: 'Elementary School',
      city: 'Springfield',
      state: 'Illinois',
      country: 'United States',
      email: 'admin@greenwood.edu',
      phone: '(555) 123-4567',
      website: 'www.greenwood-elementary.edu'
    },
    subjects: [
      { name: 'Mathematics', code: 'MATH', admin: 'None' },
      { name: 'English Language Arts', code: 'ENG', admin: 'None' },
      { name: 'Science', code: 'SCI', admin: 'None' },
      { name: 'Social Studies', code: 'SS', admin: 'None' },
      { name: 'Physical Education', code: 'PE', admin: 'None' },
      { name: 'Art & Craft', code: 'ART', admin: 'None' },
      { name: 'Music', code: 'MUS', admin: 'None' }
    ],
    timeStructure: {
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      startTime: '08:00',
      endTime: '15:00',
      theoryDuration: 45,
      labDuration: 90,
      tutorialDuration: 45,
      lunchBreak: { enabled: true, time: '12:00', duration: 45 },
      eveningBreak: { enabled: false, after: 5, duration: 10 }
    },
    rooms: [
      { number: '101', building: 'Main Block', capacity: '30', type: 'Lecture Hall', features: ['Projector', 'Smart Board'] },
      { number: '102', building: 'Main Block', capacity: '30', type: 'Lecture Hall', features: ['Projector'] },
      { number: '103', building: 'Main Block', capacity: '25', type: 'Lecture Hall', features: ['Smart Board'] },
      { number: '104', building: 'Main Block', capacity: '28', type: 'Lecture Hall', features: ['Projector'] },
      { number: '105', building: 'Main Block', capacity: '32', type: 'Lecture Hall', features: ['Air Conditioning'] },
      { number: '201', building: 'Main Block', capacity: '35', type: 'Lecture Hall', features: ['Projector', 'Air Conditioning'] },
      { number: '202', building: 'Main Block', capacity: '30', type: 'Lecture Hall', features: ['Smart Board'] },
      { number: 'Lab-1', building: 'Science Block', capacity: '20', type: 'Physics Lab', features: ['Computers', 'Sound System'] },
      { number: 'Lab-2', building: 'Science Block', capacity: '20', type: 'Computer Lab', features: ['Computers'] },
      { number: 'Gym', building: 'Sports Block', capacity: '50', type: 'Auditorium', features: ['Sound System'] },
      { number: 'Art', building: 'Art Block', capacity: '25', type: 'Lecture Hall', features: ['Air Conditioning'] },
      { number: 'Music', building: 'Art Block', capacity: '30', type: 'Lecture Hall', features: ['Sound System'] }
    ]
  },

  // Minimal data for quick testing
  minimal: {
    institution: {
      name: 'Test School',
      type: 'Elementary School',
      city: 'Test City',
      state: 'Test State',
      country: 'United States',
      email: 'test@school.edu',
      phone: '123-456-7890',
      website: 'www.test-school.edu'
    },
    subjects: [
      { name: 'Mathematics', code: 'MATH', admin: 'None' },
      { name: 'English', code: 'ENG', admin: 'None' },
      { name: 'Science', code: 'SCI', admin: 'None' }
    ],
    timeStructure: {
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      startTime: '08:00',
      endTime: '12:00',
      theoryDuration: 45,
      labDuration: 90,
      tutorialDuration: 45,
      lunchBreak: { enabled: true, time: '10:30', duration: 30 },
      eveningBreak: { enabled: false, after: 5, duration: 10 }
    },
    rooms: [
      { number: '101', building: 'Main Block', capacity: '30', type: 'Lecture Hall', features: ['Projector'] },
      { number: '102', building: 'Main Block', capacity: '25', type: 'Lecture Hall', features: [] },
      { number: '103', building: 'Main Block', capacity: '28', type: 'Computer Lab', features: ['Computers'] }
    ]
  }
};

// Auto-populate function
export const autoPopulate = (dataSet = 'full') => {
  const data = testData[dataSet];

  if (!data) {
    console.error('Invalid data set. Use "full" or "minimal"');
    return;
  }

  // Store data in localStorage (same format as Zustand persist)
  const onboardingData = {
    state: {
      institutionData: {
        ...data.institution,
        code: `SCH-2026-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
      },
      workflowData: 'Simple Workflow (Single Admin)',
      subjectsData: data.subjects,
      timeData: data.timeStructure,
      slotsData: 'Simple Time Slots',
      roomsData: data.rooms,
      constraintsData: {
        maxConsecutive: 3,
        noSaturday: true,
        maxHoursPerDay: 6,
        minGap: 0,
        firstYearMorning: true,
        maxClassesPerDay: 7,
        labConsecutive: true,
        labOnlyInLabRooms: true
      }
    },
    version: 0
  };

  localStorage.setItem('onboarding-storage', JSON.stringify(onboardingData));

  console.log(`✅ Auto-populated with ${dataSet} test data!`);
  console.log('📊 Data loaded:', onboardingData.state);
  console.log('🔄 Refresh the page to see the data in the UI');

  return onboardingData.state;
};

// Clear all data
export const clearTestData = () => {
  localStorage.removeItem('onboarding-storage');
  localStorage.removeItem('current_generation_job');
  localStorage.removeItem('generation_request');
  console.log('🗑️ Cleared all test data');
};

// Quick commands for browser console
window.autoPopulateFull = () => autoPopulate('full');
window.autoPopulateMinimal = () => autoPopulate('minimal');
window.clearTestData = clearTestData;

// Usage instructions
console.log(`
🚀 TT-Scheduler Auto-Populate Commands:

In browser console, run:
• autoPopulateFull() - Complete school data (12 rooms, 7 subjects)
• autoPopulateMinimal() - Minimal data (3 rooms, 3 subjects)
• clearTestData() - Clear all stored data

After running, refresh the page and navigate to /screen-8 to see your data!
`);