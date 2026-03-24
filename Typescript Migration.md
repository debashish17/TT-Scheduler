# Phase 2 — TypeScript Migration

Migrate all 34 `.jsx` / `.js` source files to `.tsx` / `.ts`, adding full type safety across the domain layer, state stores, API client, custom hooks, and React components.

**Scope at a glance:** `src/` contains
- 24 app components (onboarding × 9, timetable × 7, common × 2, dashboard × 1, jobs × 1, layout × 1, App)
- 10 shadcn/ui components (already in `components/ui/`)
- `api/client.js` + `api/websocket.js`
- `store/index.js` (9 Zustand stores)
- `hooks/useAPI.js` (7 custom hooks)
- `utils/helpers.js` + `utils/testData.js`
- `main.jsx`, `lib/utils.js`

---

## User Review Required

> [!IMPORTANT]
> **Strict vs. Lenient TypeScript config.**
> The plan uses `"strict": true` in `tsconfig.json`. This gives full type safety but means you'll see errors on `any`-typed API responses, `null` checks, and untyped third-party libs. Alternative: start with `"strict": false` and tighten over time. The plan below chooses **strict**.
>
> **No runtime behaviour changes.** This is a pure TypeScript conversion — zero logic changes. All existing component and store behaviour is preserved exactly.

> [!WARNING]
> **`axios` response types.** `client.js` returns raw `AxiosResponse<any>`. In the typed version each API function will return `Promise<AxiosResponse<T>>` with proper generics. Until backend schema types are fully formalised, a shared `ApiResponse<T>` wrapper type will be used.

---

## Proposed Changes

### Layer 0 — Toolchain

#### [MODIFY] [package.json](file:///c:/Users/devd9/OneDrive/Desktop/TTS/frontend/package.json)
- Add `typescript` (v5), `@types/node`, `@types/react`, `@types/react-dom` as devDependencies

#### [NEW] [tsconfig.json](file:///c:/Users/devd9/OneDrive/Desktop/TTS/frontend/tsconfig.json)
```jsonc
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

#### [NEW] [tsconfig.node.json](file:///c:/Users/devd9/OneDrive/Desktop/TTS/frontend/tsconfig.node.json)
For `vite.config.ts`

#### [MODIFY] [vite.config.js → vite.config.ts](file:///c:/Users/devd9/OneDrive/Desktop/TTS/frontend/vite.config.ts)
Rename and add `path` types import

---

### Layer 1 — Domain Types (new file, no deps)

#### [NEW] [types/index.ts](file:///c:/Users/devd9/OneDrive/Desktop/TTS/frontend/src/types/index.ts)

All shared domain interfaces derived from the existing store shapes and API payloads:

```typescript
// Core entities
export interface Institution { id: string; name: string; code: string; ... }
export interface Teacher { id: string; name: string; email: string; maxHoursPerWeek: number; ... }
export interface Batch { id: string; name: string; size: number; semester: string; ... }
export interface Subject { id: string; name: string; code: string; hoursPerWeek: number; teacherId: string; ... }
export interface Room { id: string; name: string; capacity: number; type: 'lecture' | 'lab' | 'seminar'; ... }
export interface TimeSlot { id: string; day: string; period: number; startTime: string; endTime: string; }
export interface TimetableEntry { id: string; batchId: string; subjectId: string; teacherId: string; roomId: string; slot: TimeSlot; }
export interface Timetable { id: string; institutionId: string; entries: TimetableEntry[]; generatedAt: string; }

// Onboarding store payload types
export interface InstitutionData { name: string; code: string; address?: string; }
export interface TimeData { days: string[]; periodsPerDay: number; slotDuration: number; }
export interface ConstraintsData { maxConsecutiveClasses: number; lunchBreak: boolean; ... }

// Job tracking
export type JobStatus = 'PENDING' | 'STARTED' | 'PROGRESS' | 'SUCCESS' | 'FAILURE';
export interface Job { job_id: string; status: JobStatus; progress_percentage: number; message: string; result?: unknown; error?: string; }

// Generation settings
export interface GenerationSettings { optimization_mode: 'balanced' | 'fast' | 'optimal'; time_limit_minutes: number; enable_soft_constraints: boolean; }

// UI
export type Theme = 'light' | 'dark';
export interface Notification { id: number; message: string; type: 'info' | 'success' | 'warning' | 'error'; timestamp: string; }
```

---

### Layer 2 — Utilities

#### [MODIFY] [lib/utils.js → lib/utils.ts](file:///c:/Users/devd9/OneDrive/Desktop/TTS/frontend/src/lib/utils.ts)
Already tiny — just add `ClassValue` import type from `clsx`, one-line change.

#### [MODIFY] [utils/helpers.js → utils/helpers.ts](file:///c:/Users/devd9/OneDrive/Desktop/TTS/frontend/src/utils/helpers.ts)
Add return types and parameter types to all helper functions.

#### [MODIFY] [utils/testData.js → utils/testData.ts](file:///c:/Users/devd9/OneDrive/Desktop/TTS/frontend/src/utils/testData.ts)
Type the `autoPopulate` parameter as `'full' | 'minimal'`.

---

### Layer 3 — API Client

#### [MODIFY] [api/client.js → api/client.ts](file:///c:/Users/devd9/OneDrive/Desktop/TTS/frontend/src/api/client.ts)
- Add a generic `ApiResponse<T>` type from `AxiosResponse`
- Type each API group's methods with request/response generics:
  ```typescript
  export const institutionAPI = {
    list: (params?: ListParams) => apiClient.get<Institution[]>('/institutions/', { params }),
    get: (id: string) => apiClient.get<Institution>(`/institutions/${id}`),
    create: (data: InstitutionData) => apiClient.post<Institution>('/institutions/', data),
    ...
  };
  ```
- Type the `importExcel` `onUploadProgress` parameter as `(event: AxiosProgressEvent) => void`

#### [MODIFY] [api/websocket.js → api/websocket.ts](file:///c:/Users/devd9/OneDrive/Desktop/TTS/frontend/src/api/websocket.ts)
- Define `WebSocketCallbacks` interface (`onConnect`, `onDisconnect`, `onUpdate`, `onProgress`, `onSuccess`, `onError`) 
- Type the connection map as `Map<string, WebSocket>`

---

### Layer 4 — State Stores

#### [MODIFY] [store/index.js → store/index.ts](file:///c:/Users/devd9/OneDrive/Desktop/TTS/frontend/src/store/index.ts)
Type each of the 9 Zustand stores using the `StateCreator` generic pattern:

```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist((set) => ({ ... }), { name: 'auth-storage' })
);
```

All 9 stores get typed interfaces:
`AuthState`, `InstitutionState`, `JobState`, `TimetableState`, `UIState`, `FacultyState`, `CourseState`, `RoomState`, `OnboardingState`

---

### Layer 5 — Custom Hooks

#### [MODIFY] [hooks/useAPI.js → hooks/useAPI.ts](file:///c:/Users/devd9/OneDrive/Desktop/TTS/frontend/src/hooks/useAPI.ts)
- `useJobProgress(jobId: string, options?: JobProgressOptions)` → returns `JobProgressReturn`
- `useAsync<T>(fetchFn: () => Promise<AxiosResponse<T>>, deps?: DependencyList)` → returns `AsyncReturn<T>`
- `usePagination<T>(fetchFn: PaginationFetchFn<T>, pageSize?: number)` → returns `PaginationReturn<T>`
- `useFileUpload()` → returns `FileUploadReturn`
- `useDebounce<T>(value: T, delay?: number)` → returns `T`
- `useLocalStorage<T>(key: string, initialValue: T)` → returns `[T, (val: T) => void]`
- `useForm<T extends Record<string, unknown>>(initialValues: T, onSubmit: (values: T) => Promise<void>)` → returns `FormReturn<T>`

---

### Layer 6 — UI Components (shadcn/ui)

#### [MODIFY] All 10 files in `components/ui/` (`.jsx` → `.tsx`)
These are the simplest to convert — shadcn components already have well-defined props from Radix UI. Mainly:
- Add `React.FC` or `React.forwardRef` types with `React.ComponentPropsWithoutRef<>` patterns
- Already use `cn()` — no logic changes

Files: `button.tsx`, `card.tsx`, `input.tsx`, `label.tsx`, `badge.tsx`, `dialog.tsx`, `select.tsx`, `separator.tsx`, `tooltip.tsx`, `table.tsx`

---

### Layer 7 — App Components

#### [MODIFY] `main.jsx` → `main.tsx`
One-liner — no type issues expected.

#### [MODIFY] `App.jsx` → `App.tsx`
No props — straightforward conversion.

#### [MODIFY] 9 Onboarding Components (`.jsx` → `.tsx`)

| File | Key typing work |
|---|---|
| `WelcomeScreen.jsx` | `InstitutionData`, `Teacher[]` store types |
| `BatchSetup.jsx` | `Batch[]`, `BatchFormValues` |
| `DepartmentSetup.jsx` | `Subject[]`, `SubjectFormValues` |
| `TimeStructure.jsx` | `TimeData`, day/period enums |
| `ClassroomSetup.jsx` | `Room[]`, `RoomFormValues` |
| `Constraints.jsx` | `ConstraintsData` |
| `SetupSummary.jsx` | All domain types (reads full store) |
| `SetupComplete.jsx` | `Timetable` result |
| `SlotDefinition.jsx` | `TimeSlot[]` |
| `WorkflowConfig.jsx` | `GenerationSettings` |

#### [MODIFY] 7 Timetable Components (`.jsx` → `.tsx`)

| File | Key typing work |
|---|---|
| `TimetableGrid.jsx` | `Timetable`, `TimetableEntry[]`, grid props |
| `FacultyView.jsx` | `Teacher`, filtered `TimetableEntry[]` |
| `StudentView.jsx` | `Batch`, filtered `TimetableEntry[]` |
| `GenerationProgress.jsx` | `Job`, `JobStatus` |
| `GenerationSettings.jsx` | `GenerationSettings` form |
| `AsyncGeneration.jsx` | `Job`, callback types |
| `SolutionComparison.jsx` | `Timetable[]` comparison |

#### [MODIFY] Remaining components

- `common/Header.jsx` → `Header.tsx`
- `common/ProgressBar.jsx` → `ProgressBar.tsx` — add `value: number`, `max?: number` props
- `dashboard/Dashboard.jsx` → `Dashboard.tsx`
- `jobs/JobDashboard.jsx` → `JobDashboard.tsx`
- `layout/Layout.jsx` → `Layout.tsx` — add `children: React.ReactNode`

---

## Migration Strategy

Do **NOT** attempt to migrate everything at once. Follow dependency order strictly:

```
Layer 0 (Toolchain) → Layer 1 (Types) → Layer 2 (Utils) → Layer 3 (API)
→ Layer 4 (Stores) → Layer 5 (Hooks) → Layer 6 (UI Components) → Layer 7 (App Components)
```

Each layer depends on the one above it. This avoids circular type errors and lets you verify each layer compiles before proceeding.

---

## Verification Plan

### At each layer
```powershell
# From frontend/
npx tsc --noEmit   # zero type errors before moving to next layer
```

### After all layers
```powershell
npm run build      # production build must succeed
```

### No automated frontend tests exist — manual verification:
1. Dev server starts: `npm run dev`
2. Navigate screens 1–7 (onboarding flow) — no white screens
3. Navigate to `/timetable`, `/faculty-view`, `/student-view`
4. Check browser console — zero TypeScript/React errors
5. ReactQueryDevtools still appears bottom-right

---

## Effort Estimate

| Layer | Files | Estimated effort |
|---|---|---|
| Toolchain setup | 3 new files + 1 rename | Low |
| Domain types | 1 new file | Medium (get shapes right) |
| Utils | 3 files | Low |
| API client | 2 files | Medium (generics) |
| Stores | 1 file (9 stores) | Medium |
| Hooks | 1 file (7 hooks) | Medium |
| UI components (shadcn) | 10 files | Low (Radix types help) |
| App components | 24 files | **High** (bulk of the work) |

**Total: ~44 files renamed/modified**
