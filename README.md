# Smart Timetable Scheduler - Frontend

A modern, interactive React frontend for a comprehensive timetable scheduling system for educational institutions.

## Features

### 🎓 Admin Onboarding Flow (7 Steps)
1. **Institution Information** - Basic setup with name, type, and contact details
2. **Workflow Configuration** - Choose between simple or multi-level admin workflow
3. **Department Setup** - Add departments with templates or custom setup
4. **Time Structure** - Define working days, class durations, and break times
5. **Slot Definition** - Create theory and lab slots (VIT-style or plain time slots)
6. **Classroom Setup** - Add rooms, labs, and lecture halls with capacities
7. **Constraints & Rules** - Set faculty, student, and course constraints

### 📊 Timetable Generation
- **Generation Settings** - Configure departments, optimization focus, and advanced options
- **Real-time Progress** - Live progress tracking with detailed logs
- **Solution Comparison** - Compare 3 optimized solutions with detailed metrics:
  - Room Utilization
  - Workload Balance
  - Student Gaps
  - Faculty Preferences
  - Conflict Detection

### 📅 Interactive Timetable Views
- **Grid View** - Full weekly timetable with drag-and-drop editing
- **Faculty View** - Individual faculty schedules with workload visualization
- **Room View** - Room utilization tracking
- **Batch View** - Student batch schedules

### ✨ Key Highlights
- Modern, gradient-based UI design
- Responsive layout for all screen sizes
- Real-time conflict detection
- Interactive editing with modal dialogs
- Export to PDF functionality
- Visual workload distribution charts
- Color-coded status indicators

## Tech Stack

- **React 18** - UI framework
- **React Router 6** - Navigation
- **Tailwind CSS** - Styling
- **React Icons** - Icon library
- **Vite** - Build tool

## Getting Started

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

### Build for Production

```bash
npm run build
```

The production-ready files will be in the `dist` folder.

## Project Structure

```
src/
├── components/
│   ├── common/
│   │   ├── Header.jsx           # Main header component
│   │   └── ProgressBar.jsx      # Step progress indicator
│   ├── onboarding/
│   │   ├── WelcomeScreen.jsx     # Step 1: Institution info
│   │   ├── WorkflowConfig.jsx    # Step 2: Workflow selection
│   │   ├── DepartmentSetup.jsx   # Step 3: Department setup
│   │   ├── TimeStructure.jsx     # Step 4: Time configuration
│   │   ├── SlotDefinition.jsx    # Step 5: Slot definitions
│   │   ├── ClassroomSetup.jsx    # Step 6: Room management
│   │   ├── Constraints.jsx       # Step 7: Rules & constraints
│   │   └── SetupComplete.jsx     # Setup completion summary
│   └── timetable/
│       ├── GenerationSettings.jsx   # Timetable generation config
│       ├── GenerationProgress.jsx   # Real-time progress tracker
│       ├── SolutionComparison.jsx   # Compare generated solutions
│       ├── TimetableGrid.jsx        # Interactive grid view
│       └── FacultyView.jsx          # Faculty schedule view
├── App.jsx                       # Main app component with routing
├── main.jsx                      # Application entry point
└── index.css                     # Global styles and Tailwind

```

## Navigation Flow

```
/ (redirect to /onboarding/welcome)
│
├── Onboarding Flow
│   ├── /onboarding/welcome
│   ├── /onboarding/workflow
│   ├── /onboarding/departments
│   ├── /onboarding/time-structure
│   ├── /onboarding/slots
│   ├── /onboarding/classrooms
│   ├── /onboarding/constraints
│   └── /onboarding/complete
│
└── Timetable Management
    ├── /timetable/generate
    ├── /timetable/progress
    ├── /timetable/comparison
    ├── /timetable/grid
    └── /timetable/faculty
```

## Key Features Explained

### 1. Multi-Step Onboarding
- Progressive disclosure of information
- Visual progress tracking
- Form validation
- Template-based quick setup

### 2. Intelligent Timetable Generation
- Multiple optimization strategies (Balanced, Room-Focused, Faculty-Friendly)
- Configurable constraints and preferences
- Real-time progress tracking
- Multiple solution generation for comparison

### 3. Interactive Editing
- Click-to-edit functionality
- Real-time conflict detection
- Visual feedback with color coding
- Drag-and-drop support (ready for implementation)

### 4. Comprehensive Views
- Grid view for overall schedule
- Faculty view for individual schedules
- Room utilization tracking
- Workload distribution visualization

## Customization

### Color Scheme
The primary color scheme can be customized in `tailwind.config.js`:

```javascript
colors: {
  primary: {
    50: '#f0f9ff',
    // ... customize colors
    900: '#0c4a6e',
  },
}
```

### Adding New Features
1. Create component in appropriate directory
2. Add route in `App.jsx`
3. Update navigation links
4. Implement functionality

## Mock Data

This is a **frontend-only** implementation with mock data. To connect to a backend:

1. Create API service files in `src/services/`
2. Replace mock data with API calls
3. Add state management (React Context or Redux)
4. Implement authentication
5. Add error handling

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Performance

- Code splitting with React Router
- Lazy loading for routes (ready to implement)
- Optimized bundle size with Vite
- Responsive images and assets

## Future Enhancements

- [ ] Backend integration
- [ ] Database connectivity
- [ ] User authentication
- [ ] Real-time collaboration
- [ ] Advanced analytics dashboard
- [ ] Mobile app version
- [ ] Excel/PDF import/export
- [ ] Drag-and-drop timetable editing
- [ ] Automated conflict resolution
- [ ] Email notifications

## License

MIT License - Feel free to use this project for educational purposes.

## Author

Created for educational timetable scheduling and management.

## Support

For issues or questions, please refer to the inline documentation in the code.
