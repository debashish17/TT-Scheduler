"""
Celery tasks for analytics and reporting.
Handles background analytics calculations and report generation.
"""
import logging
from typing import Dict, Any, List, Optional
from uuid import UUID, uuid4
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.celery_app import celery_app, ProgressTracker, handle_task_error, RETRY_CONFIG
from app.db.session import SessionLocal
from app.models import Timetable, TimetableStatus as DBTimetableStatus, TimetableEntry, Faculty, Classroom, Course, StudentBatch

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, **RETRY_CONFIG)
def generate_analytics_report_async(
    self,
    institution_id: str,
    report_type: str,
    parameters: Dict[str, Any],
    job_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generate comprehensive analytics report for an institution.

    Args:
        self: Celery task instance
        institution_id: Institution UUID
        report_type: Type of report (utilization, efficiency, quality, etc.)
        parameters: Report-specific parameters
        job_id: Optional job identifier

    Returns:
        Complete analytics report
    """
    if not job_id:
        job_id = str(uuid4())

    progress = ProgressTracker(self, 6)
    db = SessionLocal()

    try:
        logger.info(f"Starting analytics report generation job {job_id} for institution {institution_id}")

        # Step 1: Load timetable data
        progress.update("Loading timetable data")
        timetables = _load_timetables_for_analytics(db, institution_id, parameters)

        if not timetables:
            raise ValueError("No timetables found for analysis")

        # Step 2: Calculate resource utilization
        progress.update("Calculating resource utilization")
        utilization_metrics = _calculate_resource_utilization(db, timetables)

        # Step 3: Analyze schedule quality
        progress.update("Analyzing schedule quality")
        quality_metrics = _analyze_schedule_quality(db, timetables)

        # Step 4: Generate efficiency insights
        progress.update("Generating efficiency insights")
        efficiency_insights = _generate_efficiency_insights(db, timetables, utilization_metrics)

        # Step 5: Create trend analysis
        progress.update("Creating trend analysis")
        trend_analysis = _create_trend_analysis(db, institution_id, parameters)

        # Step 6: Compile final report
        progress.update("Compiling final report")
        report = {
            "job_id": job_id,
            "institution_id": institution_id,
            "report_type": report_type,
            "generated_at": datetime.now().isoformat(),
            "period": parameters.get("period", "current"),
            "timetables_analyzed": len(timetables),
            "utilization_metrics": utilization_metrics,
            "quality_metrics": quality_metrics,
            "efficiency_insights": efficiency_insights,
            "trend_analysis": trend_analysis,
            "recommendations": _generate_recommendations(utilization_metrics, quality_metrics)
        }

        progress.complete(report)
        logger.info(f"Analytics report completed for job {job_id}")
        return report

    except Exception as e:
        handle_task_error(self, e, "Analytics report generation")
        raise
    finally:
        db.close()


@celery_app.task(bind=True, **RETRY_CONFIG)
def calculate_faculty_workload_analysis_async(
    self,
    institution_id: str,
    semester: Optional[str] = None,
    job_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Calculate comprehensive faculty workload analysis.

    Args:
        self: Celery task instance
        institution_id: Institution UUID
        semester: Optional semester filter
        job_id: Optional job identifier

    Returns:
        Faculty workload analysis report
    """
    if not job_id:
        job_id = str(uuid4())

    progress = ProgressTracker(self, 5)
    db = SessionLocal()

    try:
        logger.info(f"Starting faculty workload analysis job {job_id}")

        # Step 1: Load faculty data
        progress.update("Loading faculty data")
        faculty_query = db.query(Faculty).filter(
            Faculty.institution_id == UUID(institution_id),
            Faculty.deleted_at.is_(None)
        )

        faculty_list = faculty_query.all()

        # Step 2: Calculate individual workloads
        progress.update("Calculating individual workloads")
        workload_data = []

        for faculty in faculty_list:
            workload = _calculate_faculty_workload_detailed(db, faculty, semester)
            workload_data.append(workload)

        # Step 3: Analyze workload distribution
        progress.update("Analyzing workload distribution")
        distribution_analysis = _analyze_workload_distribution(workload_data)

        # Step 4: Identify workload issues
        progress.update("Identifying workload issues")
        workload_issues = _identify_workload_issues(workload_data)

        # Step 5: Generate recommendations
        progress.update("Generating workload recommendations")
        recommendations = _generate_workload_recommendations(workload_data, distribution_analysis)

        result = {
            "job_id": job_id,
            "institution_id": institution_id,
            "semester": semester,
            "analysis_date": datetime.now().isoformat(),
            "faculty_count": len(faculty_list),
            "workload_data": workload_data,
            "distribution_analysis": distribution_analysis,
            "workload_issues": workload_issues,
            "recommendations": recommendations
        }

        progress.complete(result)
        return result

    except Exception as e:
        handle_task_error(self, e, "Faculty workload analysis")
        raise
    finally:
        db.close()


@celery_app.task(bind=True, **RETRY_CONFIG)
def generate_room_utilization_report_async(
    self,
    institution_id: str,
    period_days: int = 30,
    job_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generate detailed room utilization report.

    Args:
        self: Celery task instance
        institution_id: Institution UUID
        period_days: Analysis period in days
        job_id: Optional job identifier

    Returns:
        Room utilization report
    """
    if not job_id:
        job_id = str(uuid4())

    progress = ProgressTracker(self, 4)
    db = SessionLocal()

    try:
        logger.info(f"Starting room utilization report job {job_id}")

        # Step 1: Load room data
        progress.update("Loading room and assignment data")
        rooms = db.query(Classroom).filter(
            Classroom.institution_id == UUID(institution_id),
            Classroom.deleted_at.is_(None)
        ).all()

        # Step 2: Calculate utilization metrics
        progress.update("Calculating room utilization")
        room_metrics = []

        for room in rooms:
            utilization = _calculate_room_utilization_detailed(db, room, period_days)
            room_metrics.append(utilization)

        # Step 3: Analyze usage patterns
        progress.update("Analyzing usage patterns")
        usage_patterns = _analyze_room_usage_patterns(room_metrics)

        # Step 4: Generate optimization suggestions
        progress.update("Generating optimization suggestions")
        optimization_suggestions = _generate_room_optimization_suggestions(room_metrics, usage_patterns)

        result = {
            "job_id": job_id,
            "institution_id": institution_id,
            "period_days": period_days,
            "analysis_date": datetime.now().isoformat(),
            "rooms_analyzed": len(rooms),
            "room_metrics": room_metrics,
            "usage_patterns": usage_patterns,
            "optimization_suggestions": optimization_suggestions,
            "summary_statistics": {
                "average_utilization": sum(rm["utilization_percentage"] for rm in room_metrics) / len(room_metrics) if room_metrics else 0,
                "underutilized_rooms": len([rm for rm in room_metrics if rm["utilization_percentage"] < 50]),
                "overutilized_rooms": len([rm for rm in room_metrics if rm["utilization_percentage"] > 90]),
                "peak_usage_hours": _identify_peak_usage_hours(room_metrics)
            }
        }

        progress.complete(result)
        return result

    except Exception as e:
        handle_task_error(self, e, "Room utilization report")
        raise
    finally:
        db.close()


# Helper functions for analytics calculations

def _load_timetables_for_analytics(
    db: Session,
    institution_id: str,
    parameters: Dict[str, Any]
) -> List[Timetable]:
    """Load timetables based on analysis parameters."""
    query = db.query(Timetable).filter(
        Timetable.institution_id == UUID(institution_id),
        Timetable.status == DBTimetableStatus.ACTIVE
    )

    # Apply date filters if specified
    if parameters.get("start_date"):
        query = query.filter(Timetable.created_at >= parameters["start_date"])
    if parameters.get("end_date"):
        query = query.filter(Timetable.created_at <= parameters["end_date"])

    # Apply semester filter if specified
    if parameters.get("semester"):
        query = query.filter(Timetable.semester == parameters["semester"])

    return query.limit(50).all()  # Limit to prevent memory issues


def _calculate_resource_utilization(db: Session, timetables: List[Timetable]) -> Dict[str, Any]:
    """Calculate comprehensive resource utilization metrics."""
    total_assignments = 0
    faculty_hours = {}
    room_hours = {}

    for timetable in timetables:
        assignments = db.query(TimetableEntry).filter(
            TimetableEntry.timetable_id == timetable.id
        ).all()

        total_assignments += len(assignments)

        for assignment in assignments:
            faculty_id = str(assignment.faculty_id)
            room_id = str(assignment.classroom_id)

            faculty_hours[faculty_id] = faculty_hours.get(faculty_id, 0) + 1
            room_hours[room_id] = room_hours.get(room_id, 0) + 1

    # Calculate utilization percentages
    avg_faculty_utilization = sum(faculty_hours.values()) / len(faculty_hours) if faculty_hours else 0
    avg_room_utilization = sum(room_hours.values()) / len(room_hours) if room_hours else 0

    return {
        "total_assignments": total_assignments,
        "faculty_utilization": {
            "average_hours_per_week": avg_faculty_utilization,
            "total_faculty": len(faculty_hours),
            "utilization_distribution": _calculate_utilization_distribution(faculty_hours)
        },
        "room_utilization": {
            "average_hours_per_week": avg_room_utilization,
            "total_rooms": len(room_hours),
            "utilization_distribution": _calculate_utilization_distribution(room_hours)
        }
    }


def _analyze_schedule_quality(db: Session, timetables: List[Timetable]) -> Dict[str, Any]:
    """Analyze schedule quality metrics."""
    quality_scores = []
    constraint_violations = []

    for timetable in timetables:
        metrics = timetable.metrics or {}
        penalty_score = metrics.get("penalty_score")
        if penalty_score is not None:
            quality_scores.append(penalty_score)

        quality_metrics_data = metrics.get("quality_metrics", {})
        if quality_metrics_data:
            violations = quality_metrics_data.get("constraint_violations", 0)
            constraint_violations.append(violations)

    avg_quality_score = sum(quality_scores) / len(quality_scores) if quality_scores else 0
    avg_violations = sum(constraint_violations) / len(constraint_violations) if constraint_violations else 0

    return {
        "average_penalty_score": avg_quality_score,
        "average_constraint_violations": avg_violations,
        "quality_trend": "improving" if len(quality_scores) > 1 and quality_scores[-1] < quality_scores[0] else "stable",
        "timetables_analyzed": len(timetables)
    }


def _generate_efficiency_insights(
    db: Session,
    timetables: List[Timetable],
    utilization_metrics: Dict[str, Any]
) -> Dict[str, Any]:
    """Generate efficiency insights and bottleneck identification."""
    insights = {
        "bottlenecks": [],
        "optimization_opportunities": [],
        "efficiency_score": 0
    }

    # Identify bottlenecks based on utilization patterns
    faculty_util = utilization_metrics["faculty_utilization"]["average_hours_per_week"]
    room_util = utilization_metrics["room_utilization"]["average_hours_per_week"]

    if faculty_util > 35:  # Assuming 40 hours max per week
        insights["bottlenecks"].append("Faculty overutilization detected")

    if room_util > 35:  # Assuming 40 hours max per week
        insights["bottlenecks"].append("Room shortage identified")

    # Calculate efficiency score (0-100)
    assignment_rates = []
    for timetable in timetables:
        metrics = timetable.metrics or {}
        total = metrics.get("total_courses") or (timetable.generation_params or {}).get("total_courses", 0)
        assigned = metrics.get("assignment_count", 0)
        if total and assigned:
            rate = (assigned / total) * 100
            assignment_rates.append(rate)

    avg_assignment_rate = sum(assignment_rates) / len(assignment_rates) if assignment_rates else 0
    insights["efficiency_score"] = round(avg_assignment_rate, 2)

    return insights


def _create_trend_analysis(db: Session, institution_id: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
    """Create trend analysis over time."""
    # Load historical data for trend analysis
    end_date = datetime.now()
    start_date = end_date - timedelta(days=90)  # 3 months of data

    historical_timetables = db.query(Timetable).filter(
        Timetable.institution_id == UUID(institution_id),
        Timetable.created_at >= start_date,
        Timetable.status == DBTimetableStatus.ACTIVE
    ).order_by(Timetable.created_at).all()

    # Calculate trends
    monthly_data = {}
    for timetable in historical_timetables:
        month_key = timetable.created_at.strftime("%Y-%m")
        if month_key not in monthly_data:
            monthly_data[month_key] = {
                "timetables": 0,
                "avg_assignment_rate": 0,
                "avg_penalty_score": 0
            }

        month_data = monthly_data[month_key]
        month_data["timetables"] += 1
        metrics = timetable.metrics or {}
        gen_params = timetable.generation_params or {}
        total = metrics.get("total_courses") or gen_params.get("total_courses", 0)
        assigned = metrics.get("assignment_count", 0)
        penalty = metrics.get("penalty_score")

        if total and assigned:
            assignment_rate = (assigned / total) * 100
            month_data["avg_assignment_rate"] += assignment_rate

        if penalty:
            month_data["avg_penalty_score"] += penalty

    # Calculate averages
    for month_data in monthly_data.values():
        if month_data["timetables"] > 0:
            month_data["avg_assignment_rate"] /= month_data["timetables"]
            month_data["avg_penalty_score"] /= month_data["timetables"]

    return {
        "analysis_period": f"{start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}",
        "monthly_trends": monthly_data,
        "total_timetables": len(historical_timetables),
        "trend_direction": _calculate_trend_direction(monthly_data)
    }


def _generate_recommendations(utilization_metrics: Dict[str, Any], quality_metrics: Dict[str, Any]) -> List[str]:
    """Generate actionable recommendations based on analysis."""
    recommendations = []

    # Faculty utilization recommendations
    faculty_util = utilization_metrics["faculty_utilization"]["average_hours_per_week"]
    if faculty_util < 15:
        recommendations.append("Faculty underutilized - consider increasing course offerings or reducing faculty count")
    elif faculty_util > 35:
        recommendations.append("Faculty overutilized - consider hiring additional faculty or reducing course load")

    # Room utilization recommendations
    room_util = utilization_metrics["room_utilization"]["average_hours_per_week"]
    if room_util < 20:
        recommendations.append("Rooms underutilized - consider consolidating classes or reducing room inventory")
    elif room_util > 35:
        recommendations.append("Room shortage identified - consider adding more classrooms or optimizing schedules")

    # Quality recommendations
    if quality_metrics["average_penalty_score"] > 500:
        recommendations.append("High penalty scores detected - review soft constraint weights and preferences")

    if quality_metrics["average_constraint_violations"] > 0:
        recommendations.append("Constraint violations present - review hard constraints and data quality")

    return recommendations


def _calculate_faculty_workload_detailed(db: Session, faculty: Faculty, semester: Optional[str]) -> Dict[str, Any]:
    """Calculate detailed workload for a specific faculty member."""
    # Get assignments for this faculty
    query = db.query(TimetableEntry).filter(
        TimetableEntry.faculty_id == faculty.id
    )

    if semester:
        # Join with timetable to filter by semester
        query = query.join(Timetable).filter(Timetable.semester == semester)

    assignments = query.all()

    total_hours = len(assignments)  # Assuming 1 hour per assignment
    max_hours = faculty.max_hours_per_week or 20
    utilization_percentage = (total_hours / max_hours) * 100 if max_hours > 0 else 0

    return {
        "faculty_id": str(faculty.id),
        "employee_id": faculty.employee_id,
        "name": faculty.name,
        "assigned_hours": total_hours,
        "max_hours_per_week": max_hours,
        "utilization_percentage": round(utilization_percentage, 2),
        "overloaded": utilization_percentage > 100,
        "underutilized": utilization_percentage < 50,
        "course_count": len(assignments)
    }


def _analyze_workload_distribution(workload_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Analyze workload distribution patterns."""
    utilizations = [w["utilization_percentage"] for w in workload_data]

    return {
        "mean_utilization": sum(utilizations) / len(utilizations) if utilizations else 0,
        "min_utilization": min(utilizations) if utilizations else 0,
        "max_utilization": max(utilizations) if utilizations else 0,
        "overloaded_count": len([w for w in workload_data if w["overloaded"]]),
        "underutilized_count": len([w for w in workload_data if w["underutilized"]]),
        "balanced_count": len([w for w in workload_data if not w["overloaded"] and not w["underutilized"]])
    }


def _identify_workload_issues(workload_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Identify specific workload issues."""
    issues = []

    for workload in workload_data:
        if workload["overloaded"]:
            issues.append({
                "type": "overload",
                "faculty": workload["name"],
                "utilization": workload["utilization_percentage"],
                "excess_hours": workload["assigned_hours"] - workload["max_hours_per_week"]
            })
        elif workload["underutilized"]:
            issues.append({
                "type": "underutilization",
                "faculty": workload["name"],
                "utilization": workload["utilization_percentage"],
                "available_hours": workload["max_hours_per_week"] - workload["assigned_hours"]
            })

    return issues


def _generate_workload_recommendations(workload_data: List[Dict[str, Any]], distribution: Dict[str, Any]) -> List[str]:
    """Generate workload balancing recommendations."""
    recommendations = []

    if distribution["overloaded_count"] > 0:
        recommendations.append(f"Redistribute courses from {distribution['overloaded_count']} overloaded faculty")

    if distribution["underutilized_count"] > 0:
        recommendations.append(f"Assign more courses to {distribution['underutilized_count']} underutilized faculty")

    if distribution["max_utilization"] - distribution["min_utilization"] > 50:
        recommendations.append("Large utilization variance detected - consider workload redistribution")

    return recommendations


def _calculate_room_utilization_detailed(db: Session, room: Classroom, period_days: int) -> Dict[str, Any]:
    """Calculate detailed utilization for a specific room."""
    # Get recent assignments for this room
    cutoff_date = datetime.now() - timedelta(days=period_days)

    assignments = db.query(TimetableEntry).join(Timetable).filter(
        TimetableEntry.classroom_id == room.id,
        Timetable.created_at >= cutoff_date
    ).all()

    total_hours = len(assignments)
    max_possible_hours = period_days * 8  # Assuming 8 hours per day
    utilization_percentage = (total_hours / max_possible_hours) * 100 if max_possible_hours > 0 else 0

    return {
        "room_id": str(room.id),
        "room_number": room.room_number,
        "building": room.building,
        "capacity": room.capacity,
        "assigned_hours": total_hours,
        "utilization_percentage": round(utilization_percentage, 2),
        "underutilized": utilization_percentage < 50,
        "overutilized": utilization_percentage > 90,
        "assignment_count": len(assignments)
    }


def _analyze_room_usage_patterns(room_metrics: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Analyze room usage patterns."""
    return {
        "total_rooms": len(room_metrics),
        "average_utilization": sum(rm["utilization_percentage"] for rm in room_metrics) / len(room_metrics) if room_metrics else 0,
        "underutilized_rooms": [rm for rm in room_metrics if rm["underutilized"]],
        "overutilized_rooms": [rm for rm in room_metrics if rm["overutilized"]],
        "capacity_analysis": {
            "large_rooms": len([rm for rm in room_metrics if rm["capacity"] > 100]),
            "medium_rooms": len([rm for rm in room_metrics if 50 <= rm["capacity"] <= 100]),
            "small_rooms": len([rm for rm in room_metrics if rm["capacity"] < 50])
        }
    }


def _generate_room_optimization_suggestions(room_metrics: List[Dict[str, Any]], patterns: Dict[str, Any]) -> List[str]:
    """Generate room optimization suggestions."""
    suggestions = []

    underutilized = len(patterns["underutilized_rooms"])
    overutilized = len(patterns["overutilized_rooms"])

    if underutilized > 0:
        suggestions.append(f"Consider repurposing {underutilized} underutilized rooms")

    if overutilized > 0:
        suggestions.append(f"Address capacity constraints in {overutilized} overutilized rooms")

    if patterns["average_utilization"] < 60:
        suggestions.append("Overall room utilization is low - consider schedule optimization")

    return suggestions


def _calculate_utilization_distribution(hours_dict: Dict[str, int]) -> Dict[str, int]:
    """Calculate utilization distribution buckets."""
    distribution = {"low": 0, "medium": 0, "high": 0, "overloaded": 0}

    for hours in hours_dict.values():
        if hours < 10:
            distribution["low"] += 1
        elif hours < 20:
            distribution["medium"] += 1
        elif hours < 30:
            distribution["high"] += 1
        else:
            distribution["overloaded"] += 1

    return distribution


def _identify_peak_usage_hours(room_metrics: List[Dict[str, Any]]) -> List[str]:
    """Identify peak usage hours from room metrics."""
    # This is a simplified implementation
    # In a real system, you'd analyze actual time slot usage
    return ["10:00-11:00", "14:00-15:00", "15:00-16:00"]


def _calculate_trend_direction(monthly_data: Dict[str, Any]) -> str:
    """Calculate overall trend direction from monthly data."""
    if len(monthly_data) < 2:
        return "insufficient_data"

    months = sorted(monthly_data.keys())
    first_month = monthly_data[months[0]]
    last_month = monthly_data[months[-1]]

    if last_month["avg_assignment_rate"] > first_month["avg_assignment_rate"]:
        return "improving"
    elif last_month["avg_assignment_rate"] < first_month["avg_assignment_rate"]:
        return "declining"
    else:
        return "stable"