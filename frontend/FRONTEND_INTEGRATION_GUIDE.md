# Frontend Integration Guide

Complete guide for the TT-Scheduler React frontend with backend integration.

## 🎯 Overview

The frontend is built with:
- **React 18** - Modern React with hooks
- **Vite** - Fast build tool and dev server
- **TailwindCSS** - Utility-first CSS framework
- **Zustand** - Lightweight state management
- **Axios** - HTTP client for API calls
- **WebSocket** - Real-time progress tracking
- **React Hot Toast** - User notifications

## 📁 Project Structure

```
frontend/
├── src/
│   ├── api/
│   │   ├── client.js          # API client with all endpoints
│   │   └── websocket.js       # WebSocket client for real-time updates
│   ├── components/
│   │   ├── common/            # Shared components
│   │   ├── onboarding/        # Onboarding flow components
│   │   └── timetable/         # Timetable-specific components
│   │       └── AsyncGeneration.jsx  # Main async generation component
│   ├── hooks/
│   │   └── useAPI.js          # Custom React hooks
│   ├── store/
│   │   └── index.js           # Zustand stores
│   ├── utils/
│   │   └── helpers.js         # Utility functions
│   ├── App.jsx                # Main app component
│   └── main.jsx               # App entry point
├── .env.example               # Environment variables template
└── package.json               # Dependencies
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Update .env with your backend URL
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

### 3. Start Development Server

```bash
npm run dev
```

Frontend will be available at: `http://localhost:5173`

## 🔌 API Integration

### API Client Usage

The API client (`src/api/client.js`) provides typed methods for all backend endpoints:

```javascript
import api from './api/client';

// Timetable generation
const response = await api.timetable.generate({
  institution_id: 'uuid',
  semester: 'Fall 2024',
  optimization_mode: 'balanced',
  time_limit_minutes: 5
});

// Background jobs
const jobResponse = await api.jobs.submitTimetableGeneration(data);

// Faculty import
const importResponse = await api.faculty.importExcel(institutionId, file);

// Get job status
const statusResponse = await api.jobs.getStatus(jobId);
```

### Available API Modules

- `api.institution` - Institution management
- `api.faculty` - Faculty CRUD and import/export
- `api.course` - Course management
- `api.room` - Classroom management
- `api.timetable` - Timetable generation and analysis
- `api.jobs` - Background job management
- `api.department` - Department management
- `api.batch` - Student batch management

## 🔄 WebSocket Integration

### Real-Time Progress Tracking

The WebSocket client (`src/api/websocket.js`) handles real-time job updates:

```javascript
import wsClient from './api/websocket';

// Connect to job progress updates
wsClient.connectToJob(jobId, {
  onConnect: () => console.log('Connected'),
  onProgress: (data) => console.log(`Progress: ${data.progress_percentage}%`),
  onSuccess: (data) => console.log('Job completed!', data),
  onError: (data) => console.error('Job failed', data),
  onDisconnect: () => console.log('Disconnected')
});

// Disconnect when done
wsClient.disconnect(jobId);
```

### Features

- **Automatic Reconnection**: Exponential backoff on connection loss
- **Multiple Connections**: Track multiple jobs simultaneously
- **Fallback Polling**: Automatic fallback to HTTP polling if WebSocket fails
- **Clean Disconnect**: Automatic cleanup on page unload

## 🪝 Custom React Hooks

### useJobProgress

Track background job progress with WebSocket:

```javascript
import { useJobProgress } from './hooks/useAPI';

function MyComponent() {
  const { status, isConnected, isRunning, isSuccess, cancel } = useJobProgress(
    jobId,
    {
      onProgress: (data) => console.log(data),
      onSuccess: (data) => toast.success('Done!'),
      autoConnect: true
    }
  );

  return (
    <div>
      <p>Status: {status.state}</p>
      <p>Progress: {status.progress}%</p>
      {isRunning && <button onClick={cancel}>Cancel</button>}
    </div>
  );
}
```

### useAsync

Simplified async data fetching:

```javascript
import { useAsync } from './hooks/useAPI';

function DataComponent() {
  const { data, loading, error, refetch } = useAsync(
    () => api.faculty.list(),
    [] // dependencies
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{/* Render data */}</div>;
}
```

### usePagination

Paginated data fetching:

```javascript
import { usePagination } from './hooks/useAPI';

function PaginatedList() {
  const {
    data,
    currentPage,
    totalPages,
    nextPage,
    prevPage,
    goToPage
  } = usePagination(
    (skip, limit) => api.faculty.list({ skip, limit }),
    20 // page size
  );

  return (
    <div>
      {/* Render items */}
      <button onClick={prevPage}>Previous</button>
      <span>Page {currentPage} of {totalPages}</span>
      <button onClick={nextPage}>Next</button>
    </div>
  );
}
```

### useFileUpload

File upload with progress tracking:

```javascript
import { useFileUpload } from './hooks/useAPI';

function FileUploader() {
  const { upload, uploading, progress, error } = useFileUpload();

  const handleUpload = async (file) => {
    const result = await upload(
      (file, onProgress) => api.faculty.importExcel(institutionId, file, onProgress),
      file
    );
    console.log('Upload complete:', result);
  };

  return (
    <div>
      <input type="file" onChange={(e) => handleUpload(e.target.files[0])} />
      {uploading && <progress value={progress} max="100" />}
    </div>
  );
}
```

### useForm

Form state management:

```javascript
import { useForm } from './hooks/useAPI';

function MyForm() {
  const { values, errors, handleChange, handleSubmit, isSubmitting } = useForm(
    { name: '', email: '' },
    async (formValues) => {
      await api.faculty.create(formValues);
      toast.success('Created!');
    }
  );

  return (
    <form onSubmit={handleSubmit}>
      <input
        name="name"
        value={values.name}
        onChange={handleChange}
        placeholder="Name"
      />
      {errors.name && <span>{errors.name}</span>}

      <button type="submit" disabled={isSubmitting}>
        Submit
      </button>
    </form>
  );
}
```

## 🗂️ State Management (Zustand)

### Global Stores

```javascript
import {
  useAuthStore,
  useInstitutionStore,
  useJobStore,
  useTimetableStore,
  useUIStore
} from './store';

function MyComponent() {
  // Auth state
  const { user, isAuthenticated, login, logout } = useAuthStore();

  // Institution state
  const { currentInstitution, setCurrentInstitution } = useInstitutionStore();

  // Job tracking
  const { activeJobs, addJob, updateJob, completeJob } = useJobStore();

  // Timetable state
  const { currentTimetable, generationSettings } = useTimetableStore();

  // UI state
  const { sidebarOpen, theme, toggleSidebar, addNotification } = useUIStore();

  // Use state...
}
```

### Store Features

- **Persistent Storage**: Auth and institution data persist in localStorage
- **Computed Values**: Derived state with selectors
- **Actions**: Update state with type-safe methods
- **Subscriptions**: React to store changes

## 🎨 Component Examples

### Async Timetable Generation

Full-featured component with:
- Form validation
- Real-time progress tracking
- WebSocket integration
- Result display
- Export functionality

```javascript
import AsyncTimetableGeneration from './components/timetable/AsyncGeneration';

function App() {
  return <AsyncTimetableGeneration />;
}
```

**Features:**
- ✅ Real-time progress bar with WebSocket updates
- ✅ 8-step progress tracking
- ✅ Optimization mode selection (Fast/Balanced/Quality)
- ✅ Soft constraint configuration
- ✅ Email notifications
- ✅ Result statistics display
- ✅ Download generated timetable
- ✅ Job cancellation
- ✅ Error handling
- ✅ Automatic fallback to polling

## 🛠️ Utility Functions

### Date/Time

```javascript
import { formatDate, formatDuration, formatTimeSlot } from './utils/helpers';

formatDate('2024-03-19T10:15:30Z'); // "Mar 19, 2024, 10:15 AM"
formatDuration(142); // "2m 22s"
formatTimeSlot('09:00', '10:00'); // "09:00 - 10:00"
```

### Status Helpers

```javascript
import { getStatusColor, getPercentageColor } from './utils/helpers';

const badgeClass = getStatusColor('SUCCESS'); // "bg-green-100 text-green-800"
const textClass = getPercentageColor(92); // "text-green-600"
```

### File Operations

```javascript
import { downloadFile, formatFileSize } from './utils/helpers';

// Download blob as file
downloadFile(blob, 'timetable.xlsx');

// Format file size
formatFileSize(1024 * 1024); // "1.00 MB"
```

### Array Operations

```javascript
import { groupBy, sortBy, filterBySearch } from './utils/helpers';

// Group by property
const grouped = groupBy(faculty, 'department_id');

// Sort by property
const sorted = sortBy(courses, 'name', 'asc');

// Filter by search term
const filtered = filterBySearch(faculty, 'john', ['name', 'email']);
```

## 📊 Real-World Usage Examples

### Example 1: Submit Async Generation with Progress Tracking

```javascript
import React, { useState } from 'react';
import api from './api/client';
import { useJobProgress } from './hooks/useAPI';
import toast from 'react-hot-toast';

function QuickGeneration() {
  const [jobId, setJobId] = useState(null);

  const { status, isRunning, isSuccess } = useJobProgress(jobId, {
    onSuccess: (data) => {
      toast.success(`Generated in ${data.result.generation_time}s!`);
    }
  });

  const startGeneration = async () => {
    const response = await api.jobs.submitTimetableGeneration({
      institution_id: 'uuid',
      semester: 'Fall 2024',
      optimization_mode: 'fast'
    });

    setJobId(response.data.job_id);
  };

  return (
    <div>
      {!jobId && (
        <button onClick={startGeneration}>Generate</button>
      )}

      {isRunning && (
        <div>
          <p>{status.currentStep}</p>
          <progress value={status.progress} max="100" />
        </div>
      )}

      {isSuccess && (
        <div>
          <p>Assignment Rate: {status.result.assignment_rate}%</p>
          <p>Generated in: {status.result.generation_time}s</p>
        </div>
      )}
    </div>
  );
}
```

### Example 2: Bulk Faculty Import with Progress

```javascript
import React from 'react';
import { useFileUpload } from './hooks/useAPI';
import api from './api/client';

function FacultyImporter({ institutionId }) {
  const { upload, uploading, progress } = useFileUpload();

  const handleImport = async (event) => {
    const file = event.target.files[0];

    const result = await upload(
      (file, onProgress) => api.faculty.importExcel(institutionId, file, onProgress),
      file
    );

    console.log(`Imported ${result.successful_imports} faculty members`);
  };

  return (
    <div>
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={handleImport}
        disabled={uploading}
      />

      {uploading && (
        <div>
          <p>Uploading: {progress}%</p>
          <progress value={progress} max="100" />
        </div>
      )}
    </div>
  );
}
```

### Example 3: Faculty List with Pagination and Search

```javascript
import React, { useState } from 'react';
import { usePagination, useDebounce } from './hooks/useAPI';
import { filterBySearch } from './utils/helpers';
import api from './api/client';

function FacultyList() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);

  const { data, currentPage, totalPages, nextPage, prevPage, loading } = usePagination(
    (skip, limit) => api.faculty.list({ skip, limit, q: debouncedSearch }),
    20
  );

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search faculty..."
      />

      <table>
        <thead>
          <tr>
            <th>Employee ID</th>
            <th>Name</th>
            <th>Department</th>
            <th>Workload</th>
          </tr>
        </thead>
        <tbody>
          {data.map((faculty) => (
            <tr key={faculty.id}>
              <td>{faculty.employee_id}</td>
              <td>{faculty.name}</td>
              <td>{faculty.department_code}</td>
              <td>{faculty.current_workload}h</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div>
        <button onClick={prevPage} disabled={currentPage === 1}>
          Previous
        </button>
        <span>Page {currentPage} of {totalPages}</span>
        <button onClick={nextPage} disabled={currentPage === totalPages}>
          Next
        </button>
      </div>
    </div>
  );
}
```

## 🎯 Next Steps

### Immediate

1. **Install Dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your backend URL
   ```

3. **Start Dev Server**
   ```bash
   npm run dev
   ```

### Development

1. **Add Authentication**: Implement login/

logout with JWT tokens
2. **Build Onboarding Flow**: Guide users through institution setup
3. **Create Dashboard**: Overview of timetables, jobs, and analytics
4. **Add Analytics Views**: Visualize utilization and quality metrics
5. **Implement Comparison**: Side-by-side timetable comparison
6. **Export Functionality**: Excel/PDF downloads with custom formatting

### Production

1. **Build for Production**
   ```bash
   npm run build
   ```

2. **Preview Build**
   ```bash
   npm run preview
   ```

3. **Deploy** to your hosting platform (Vercel, Netlify, etc.)

## 🐛 Troubleshooting

### CORS Issues

If you encounter CORS errors, ensure backend CORS is configured:

```python
# backend/app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### WebSocket Connection Failed

1. Check if backend WebSocket endpoint is accessible
2. Verify WebSocket URL in `.env`
3. Check browser console for connection errors
4. System will automatically fall back to HTTP polling

### API Calls Failing

1. Verify backend is running on correct port
2. Check `.env` configuration
3. Verify API endpoint URLs in `api/client.js`
4. Check browser network tab for error details

## 📚 Resources

- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [TailwindCSS Documentation](https://tailwindcss.com)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Axios Documentation](https://axios-http.com)

## ✅ Success Criteria

- [x] API client with all backend endpoints
- [x] WebSocket client for real-time updates
- [x] Custom React hooks for API interactions
- [x] Global state management with Zustand
- [x] Async timetable generation component
- [x] File upload with progress tracking
- [x] Job progress tracking with WebSocket
- [x] Utility helper functions
- [x] Environment configuration
- [x] Comprehensive documentation

---

**Frontend Integration Status: ✅ COMPLETE**

The TT-Scheduler frontend is fully integrated with the backend, providing a modern, responsive user interface with real-time updates and comprehensive timetable management capabilities!