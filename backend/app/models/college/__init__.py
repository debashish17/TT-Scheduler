from app.models.college.time_config       import CollegeTimeConfig
from app.models.college.hard_constraints  import CollegeHardConstraints
from app.models.college.department        import CollegeDepartment
from app.models.college.course            import CollegeCourse
from app.models.college.faculty           import CollegeFaculty
from app.models.college.section           import CollegeSection
from app.models.college.room              import CollegeRoom
from app.models.college.faculty_course    import CollegeFacultyCourse
from app.models.college.assignment        import CollegeAssignment, CollegeSlotKind

__all__ = [
    "CollegeTimeConfig", "CollegeHardConstraints", "CollegeDepartment",
    "CollegeCourse", "CollegeFaculty", "CollegeSection", "CollegeRoom",
    "CollegeFacultyCourse", "CollegeAssignment", "CollegeSlotKind",
]
