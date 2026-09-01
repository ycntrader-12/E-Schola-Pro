from datetime import date, datetime

from pydantic import BaseModel


class AttendanceBase(BaseModel):
    user_id: int
    date: date
    status: str  # "present", "late", "absent", "excused"
    minutes_late: int = 0
    session_name: str = "Session Principale"
    remarks: str | None = None


class AttendanceCreate(AttendanceBase):
    pass


class AttendanceUpdate(BaseModel):
    status: str | None = None
    minutes_late: int | None = None
    session_name: str | None = None
    remarks: str | None = None


class AttendanceBatchItem(BaseModel):
    user_id: int
    status: str = "present"
    minutes_late: int = 0
    remarks: str | None = None


class AttendanceBatchCreate(BaseModel):
    date: date
    session_name: str = "Session Principale"
    records: list[AttendanceBatchItem]


class UserSimpleOut(BaseModel):
    id: int
    email: str
    role: str
    group_name: str | None = "Groupe A - Informatique & IA"

    class Config:
        from_attributes = True


class AttendanceOut(BaseModel):
    id: int
    user_id: int
    marked_by_id: int | None = None
    date: date
    status: str
    minutes_late: int
    session_name: str
    remarks: str | None = None
    created_at: datetime
    user: UserSimpleOut | None = None
    marked_by: UserSimpleOut | None = None

    class Config:
        from_attributes = True


class PeriodStats(BaseModel):
    period_name: str
    total_sessions: int
    present: int
    late: int
    absent: int
    excused: int
    attendance_rate: float  # Percentage (present + late) / total
    quiz_points: int
    quiz_average_note: float  # out of 20
    quizzes_taken: int
    quiz_success_rate: float  # Percentage of quizzes passed


class DashboardPerformanceOut(BaseModel):
    user_id: int
    user_email: str
    user_role: str
    daily: PeriodStats
    monthly: PeriodStats
    semester: PeriodStats
    overall: PeriodStats
    recent_attendances: list[AttendanceOut]


class GlobalAttendanceOverview(BaseModel):
    total_records: int
    total_students: int
    today_present: int
    today_late: int
    today_absent: int
    today_attendance_rate: float
    monthly_attendance_rate: float
