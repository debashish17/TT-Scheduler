# 🚀 TT-Scheduler Quick Test Guide

## 1. Start the System

```bash
# Terminal 1 - Frontend only (backend optional)
cd frontend && npm run dev
```

Navigate to: `http://localhost:5173`

## 2. Auto-Populate Test Data

**Open browser console (F12) and run:**

```javascript
// For complete school demo
autoPopulateFull()

// OR for minimal testing
autoPopulateMinimal()
```

**Then refresh the page!**

## 3. Test the Complete Flow

### Option A: See Your Data Immediately
- Navigate to `/screen-8` - See your auto-populated school data
- Institution: "Greenwood Elementary School"
- Subjects: Mathematics, English, Science, etc.
- Rooms: 12 classrooms with real capacities

### Option B: Walk Through Full Onboarding
- Start at `/screen-1`
- Your data is pre-filled automatically
- Walk through all 13 screens to see the complete flow

## 4. Generate Timetable

1. **Screen 9 - Generation Settings:**
   - Shows your real school name and subjects
   - Select which subjects to include
   - Choose 3 solutions, 5 minute generation
   - Click "Generate Timetable"

2. **Screen 10 - Progress Simulation:**
   - Realistic CP-SAT simulation (no backend needed)
   - Uses your actual school data for timing
   - 8 steps: validation → optimization → solutions

3. **Screen 11 - Results:**
   - Multiple timetable solutions based on your data
   - Real metrics: assignments, utilization, conflicts
   - Choose best solution for your school

## 5. What You Should See

✅ **Real Data:** Your school name, subjects, and room counts throughout
✅ **No Backend Errors:** Graceful offline mode with simulation
✅ **Realistic Results:** Generated based on your actual configuration
✅ **Complete Flow:** All 13 screens working end-to-end
✅ **Persistent Data:** Survives browser refresh

## 6. Testing Scenarios

### Quick Test (2 minutes):
```javascript
autoPopulateMinimal()  // 3 subjects, 3 rooms
```
- Navigate to `/screen-9` → Generate → See results

### Full Demo (5 minutes):
```javascript
autoPopulateFull()  // 7 subjects, 12 rooms
```
- Walk through `/screen-1` to `/screen-11`
- Experience complete school onboarding

### Reset Test:
```javascript
clearTestData()  // Clear everything
```
- Start fresh with manual data entry

## 7. Debug Console

**Check these for verification:**
- `localStorage.getItem('onboarding-storage')` - Your school data
- `localStorage.getItem('generation_request')` - Generation settings
- `localStorage.getItem('generation_result')` - Final results

## 8. Expected Results

**After auto-populate + generation:**
- Institution: Greenwood Elementary School
- Subjects: 5-7 configured subjects
- Rooms: 3-12 classrooms with capacities
- Results: 2-3 optimized timetable solutions
- Mode: Offline simulation (no backend required)

## 9. Troubleshooting

**If you see errors:**
- Make sure you refreshed after `autoPopulateFull()`
- Check console for auto-populate confirmation
- Try `clearTestData()` then `autoPopulateFull()` again

**If generation fails:**
- The system automatically uses offline mode
- You should see "Offline Simulation Mode" in progress
- All results are mock but realistic based on your data

## 10. What This Demonstrates

✅ **Complete School Onboarding:** 13-screen linear workflow
✅ **Real Data Persistence:** localStorage with Zustand
✅ **CP-SAT Integration Ready:** Proper API structure for backend
✅ **Offline-First Design:** Works without any backend setup
✅ **School-Focused UX:** Elementary/secondary school optimized
✅ **Production-Ready UI:** Professional timetable scheduler interface

Perfect for demos, testing, and development! 🎯