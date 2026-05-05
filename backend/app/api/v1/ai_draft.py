"""
AI Draft endpoint — accepts a plain-English description of a timetable setup
and returns a pre-filled wizard payload using the Anthropic Claude API.

Requires ANTHROPIC_API_KEY to be set in the backend environment.
Uses httpx (already in requirements) to avoid adding a new dependency.
"""
import json
import logging

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


class DraftRequest(BaseModel):
    description: str


SYSTEM_PROMPT = """\
You are an expert timetable scheduler assistant.
Given a plain-English description of a school or college timetable setup,
return a JSON object that pre-fills a scheduling wizard.

Return ONLY valid JSON — no markdown fences, no explanation, no extra text.

══════════════════════════════════════════════════════
DECISION RULE
══════════════════════════════════════════════════════
• If the description mentions "college", "university", "department", "faculty",
  "course", "semester", "credits", or "lab" in a higher-education context
  → use the COLLEGE schema below.
• Otherwise (school, primary, high school, classes, sections, grade)
  → use the SCHOOL schema below.

══════════════════════════════════════════════════════
SCHOOL SCHEMA  (type = "school")
══════════════════════════════════════════════════════
{
  "institution_data": {
    "name": "string",
    "type": "school",
    "code": "SHORT_CODE",
    "academic_year": "2025-26"
  },
  "classes_data": [
    { "name": "string", "size": <number>, "subjects": ["SUBJ_CODE", ...] }
  ],
  "subjects_data": [
    { "code": "SUBJ_CODE", "name": "string", "periods_per_week": <number>, "type": "lecture" | "lab" }
  ],
  "teachers_data": [
    { "name": "string", "code": "T001", "subjects": ["SUBJ_CODE", ...] }
  ],
  "time_data": {
    "workingDays": ["Mon", "Tue", "Wed", "Thu", "Fri"],
    "periodsPerDay": <number>,
    "startTime": "08:00",
    "periodDurationMinutes": 50,
    "lunchPeriodIndex": <0-based index>
  },
  "rooms_data": [
    { "name": "string", "capacity": <number>, "type": "classroom" | "lab" }
  ],
  "constraints_data": {
    "maxPeriodsPerDayPerTeacher": 5,
    "avoidConsecutiveSameSubject": true
  }
}

School rules:
- workingDays uses short names: "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun".
- periodsPerDay defaults to 7; lunchPeriodIndex defaults to 4 (0-based, i.e. 5th period).
- Subject codes: short UPPERCASE (MATH, ENG, SCI, HIS, PE, ART …).
- Teacher codes: T001, T002, …
- Distribute subjects evenly among teachers.
- Every class lists all subject codes it attends.

══════════════════════════════════════════════════════
COLLEGE SCHEMA  (type = "college")
══════════════════════════════════════════════════════
{
  "institution_data": {
    "name": "string",
    "type": "college",
    "code": "SHORT_CODE",
    "academic_year": "2025-26"
  },
  "college_institution": {
    "name": "string",
    "semester": <1-8>,
    "departments": [
      { "code": "CS", "name": "Computer Science" }
    ]
  },
  "course_offerings": [
    {
      "code": "CS501",
      "name": "string",
      "department": "CS",
      "year": <1-4>,
      "credits": <2|3|4>,
      "enrolled_students": <number>,
      "is_elective": false,
      "required_lecture_room_type": "classroom" | "lecture_hall" | "seminar_room",
      "required_lab_room_type": "computer_lab" | "physics_lab" | "chemistry_lab" | null
    }
  ],
  "college_faculty": [
    {
      "code": "FAC01",
      "name": "string",
      "department": "CS",
      "courses_can_teach": ["CS501", "CS502"],
      "max_hours_per_week": 18
    }
  ],
  "college_rooms": [
    { "name": "string", "capacity": <number>, "room_type": "classroom" | "lecture_hall" | "computer_lab" | "physics_lab" | "chemistry_lab" | "seminar_room" }
  ],
  "college_schedule": {
    "workingDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "periodsPerDay": <number>,
    "periodDurationMinutes": 60,
    "startTime": "08:00",
    "lunchPeriodIndex": <0-based index>
  },
  "college_constraints": {
    "maxConsecutivePeriods": 3,
    "maxPeriodsPerDayPerFaculty": 6
  }
}

College rules:
- workingDays uses FULL day names: "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday".
- periodsPerDay defaults to 6; lunchPeriodIndex defaults to 3 (0-based, i.e. 4th period).
- credits=2 → 2 lectures/week; credits=3 → 3 lectures/week; credits=4 → 3 lectures + 1 lab/week (set required_lab_room_type).
- required_lab_room_type must be null when credits != 4.
- Faculty codes: FAC01, FAC02, …; course codes: DEPT + number (e.g. CS501).
- Every faculty member lists the course codes they can teach.
- Use "lecture_hall" for large enrolled courses (>60 students), "classroom" otherwise.
"""


@router.post("/ai-draft")
async def ai_draft(req: DraftRequest):
    """
    Generate a pre-filled wizard payload from a plain-English description.
    Requires ANTHROPIC_API_KEY to be set in the backend .env file.
    """
    api_key = settings.ANTHROPIC_API_KEY
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail=(
                "AI draft is not configured. "
                "Set ANTHROPIC_API_KEY in the backend environment variables."
            ),
        )

    if not req.description.strip():
        raise HTTPException(status_code=400, detail="Description cannot be empty.")

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": settings.ANTHROPIC_MODEL,
                    "max_tokens": 2048,
                    "system": SYSTEM_PROMPT,
                    "messages": [
                        {"role": "user", "content": req.description.strip()},
                    ],
                },
            )

        if response.status_code == 401:
            raise HTTPException(status_code=502, detail="Invalid Anthropic API key.")
        if response.status_code == 429:
            raise HTTPException(status_code=429, detail="Anthropic rate limit hit. Try again in a moment.")
        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"Anthropic API returned status {response.status_code}.",
            )

        raw = response.json()["content"][0]["text"].strip()

        # Strip markdown code fences if the model wrapped its output
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        wizard_data = json.loads(raw)
        logger.info("AI draft generated for: %.80s", req.description)
        return wizard_data

    except json.JSONDecodeError as exc:
        logger.error("AI returned invalid JSON: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="AI returned malformed JSON. Please try again or rephrase your description.",
        )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="AI request timed out. Please try again.")
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Unexpected error in ai_draft")
        raise HTTPException(status_code=500, detail=f"AI draft failed: {exc}")
