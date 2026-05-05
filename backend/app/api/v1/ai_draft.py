"""
AI Draft endpoint — accepts a plain-English description of a timetable setup
and returns a pre-filled wizard payload using the OpenAI Chat Completions API.

Requires OPENAI_API_KEY to be set in the backend environment.
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
return a JSON object that can be used to pre-fill a scheduling wizard.

Return ONLY valid JSON — no markdown fences, no explanation, no extra text.
Use this exact structure:

{
  "institution_data": {
    "name": "string",
    "type": "school" | "college",
    "code": "SHORT_CODE",
    "academic_year": "2025-26"
  },
  "classes_data": [
    { "name": "string", "size": number, "subjects": ["SUBJ_CODE", ...] }
  ],
  "subjects_data": [
    { "code": "SUBJ_CODE", "name": "string", "periods_per_week": number, "type": "lecture" | "lab" }
  ],
  "teachers_data": [
    { "name": "string", "code": "T001", "subjects": ["SUBJ_CODE", ...] }
  ],
  "time_data": {
    "workingDays": ["Mon", "Tue", "Wed", "Thu", "Fri"],
    "periodsPerDay": number,
    "startTime": "08:00",
    "periodDurationMinutes": 50,
    "lunchPeriodIndex": 4
  },
  "rooms_data": [
    { "name": "string", "capacity": number, "type": "classroom" | "lab" }
  ],
  "constraints_data": {
    "maxPeriodsPerDayPerTeacher": 5,
    "avoidConsecutiveSameSubject": true
  }
}

Rules:
- Generate realistic names and codes from the description.
- Subject codes must be short UPPERCASE strings (e.g. MATH, ENG, SCI).
- Teacher codes follow the pattern T001, T002, …
- If a number is not specified, use sensible defaults.
- Distribute subjects evenly among teachers.
- Assign subjects to classes that are appropriate for the described level.
- If "college" or "department" is mentioned, set type to "college".
- periodsPerDay should match the description; default to 7 for school, 6 for college.
- lunchPeriodIndex is 0-based; place lunch after roughly half the periods.
"""


@router.post("/ai-draft")
async def ai_draft(req: DraftRequest):
    """
    Generate a pre-filled wizard payload from a plain-English description.
    Requires OPENAI_API_KEY to be set in the backend .env file.
    """
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail=(
                "AI draft is not configured. "
                "Set OPENAI_API_KEY in the backend environment variables."
            ),
        )

    if not req.description.strip():
        raise HTTPException(status_code=400, detail="Description cannot be empty.")

    try:
        async with httpx.AsyncClient(timeout=50.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user",   "content": req.description.strip()},
                    ],
                    "temperature": 0.3,
                    "max_tokens": 2048,
                },
            )

        if response.status_code == 401:
            raise HTTPException(status_code=502, detail="Invalid OpenAI API key.")
        if response.status_code == 429:
            raise HTTPException(status_code=429, detail="OpenAI rate limit hit. Try again in a moment.")
        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"OpenAI API returned status {response.status_code}.",
            )

        raw = response.json()["choices"][0]["message"]["content"].strip()

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
