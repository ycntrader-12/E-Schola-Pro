from datetime import date, datetime, timedelta

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, SessionDep
from app.models.attendance import Attendance
from app.models.quiz import QuizAttempt
from app.models.user import User
from app.schemas.attendance import (
    AttendanceBatchCreate,
    AttendanceCreate,
    AttendanceOut,
    DashboardPerformanceOut,
    GlobalAttendanceOverview,
    PeriodStats,
    UserSimpleOut,
)

router = APIRouter()


def calculate_period_stats(
    period_name: str, start_date: date, end_date: date, user_id: int, session: Session
) -> PeriodStats:
    # 1. Attendance queries
    records = (
        session.query(Attendance)
        .filter(
            Attendance.user_id == user_id,
            Attendance.date >= start_date,
            Attendance.date <= end_date,
        )
        .all()
    )

    total = len(records)
    present = sum(1 for r in records if r.status == "present")
    late = sum(1 for r in records if r.status == "late")
    absent = sum(1 for r in records if r.status == "absent")
    excused = sum(1 for r in records if r.status == "excused")

    if total > 0:
        effective_present = present + late
        rate = round((effective_present / total) * 100, 1)
    else:
        rate = 100.0

    # 2. Quiz attempts queries
    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    quiz_attempts = (
        session.query(QuizAttempt)
        .filter(
            QuizAttempt.user_id == user_id,
            QuizAttempt.completed_at >= start_dt,
            QuizAttempt.completed_at <= end_dt,
        )
        .all()
    )

    quizzes_taken = len(quiz_attempts)
    quiz_points = sum(a.score for a in quiz_attempts)
    if quizzes_taken > 0:
        average_note = round(
            sum((a.score / a.max_score * 20) for a in quiz_attempts if a.max_score > 0)
            / quizzes_taken,
            1,
        )
        passed_count = sum(1 for a in quiz_attempts if a.percentage >= 60)
        success_rate = round((passed_count / quizzes_taken) * 100, 1)
    else:
        average_note = 0.0
        success_rate = 0.0

    return PeriodStats(
        period_name=period_name,
        total_sessions=total,
        present=present,
        late=late,
        absent=absent,
        excused=excused,
        attendance_rate=rate,
        quiz_points=quiz_points,
        quiz_average_note=average_note,
        quizzes_taken=quizzes_taken,
        quiz_success_rate=success_rate,
    )


# --------------------------------------------------------------------------
# 1. LEARNER DASHBOARD STATS (Journalier, Mensuel, Semestriel, Overall)
# --------------------------------------------------------------------------
@router.get("/my-stats", response_model=DashboardPerformanceOut)
def get_my_dashboard_performance(session: SessionDep, current_user: CurrentUser):
    today = date.today()
    month_start = today.replace(day=1)
    semester_start = today - timedelta(days=180)
    all_time_start = date(2020, 1, 1)

    daily_stats = calculate_period_stats(
        "Journalier", today, today, current_user.id, session
    )
    monthly_stats = calculate_period_stats(
        "Mensuel", month_start, today, current_user.id, session
    )
    semester_stats = calculate_period_stats(
        "Semestriel", semester_start, today, current_user.id, session
    )
    overall_stats = calculate_period_stats(
        "Global", all_time_start, today, current_user.id, session
    )

    recent_attendances = (
        session.query(Attendance)
        .filter(Attendance.user_id == current_user.id)
        .order_by(Attendance.date.desc())
        .limit(50)
        .all()
    )

    return DashboardPerformanceOut(
        user_id=current_user.id,
        user_email=current_user.email,
        user_role=current_user.role,
        daily=daily_stats,
        monthly=monthly_stats,
        semester=semester_stats,
        overall=overall_stats,
        recent_attendances=recent_attendances,
    )


ADMIN_ROLES = ["admin", "admin_manager", "admin_limited"]


@router.get("/user-stats/{user_id}", response_model=DashboardPerformanceOut)
def get_user_dashboard_performance(user_id: int, session: SessionDep, current_user: CurrentUser):
    if current_user.role not in ["formateur"] + ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé."
        )

    target_user = session.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")

    today = date.today()
    month_start = today.replace(day=1)
    semester_start = today - timedelta(days=180)
    all_time_start = date(2020, 1, 1)

    daily_stats = calculate_period_stats(
        "Journalier", today, today, target_user.id, session
    )
    monthly_stats = calculate_period_stats(
        "Mensuel", month_start, today, target_user.id, session
    )
    semester_stats = calculate_period_stats(
        "Semestriel", semester_start, today, target_user.id, session
    )
    overall_stats = calculate_period_stats(
        "Global", all_time_start, today, target_user.id, session
    )

    recent_attendances = (
        session.query(Attendance)
        .filter(Attendance.user_id == target_user.id)
        .order_by(Attendance.date.desc())
        .limit(50)
        .all()
    )

    return DashboardPerformanceOut(
        user_id=target_user.id,
        user_email=target_user.email,
        user_role=target_user.role,
        daily=daily_stats,
        monthly=monthly_stats,
        semester=semester_stats,
        overall=overall_stats,
        recent_attendances=recent_attendances,
    )


@router.get("/my-records", response_model=list[AttendanceOut])
def get_my_attendance_records(
    session: SessionDep,
    current_user: CurrentUser,
    target_date: date | None = Query(None),
    status_filter: str | None = Query(None),
):
    query = session.query(Attendance).filter(Attendance.user_id == current_user.id)
    if target_date:
        query = query.filter(Attendance.date == target_date)
    if status_filter:
        query = query.filter(Attendance.status == status_filter)
    return query.order_by(Attendance.date.desc(), Attendance.id.desc()).all()


# --------------------------------------------------------------------------
# 2. LIST LEARNERS & GROUPS (Strictly Formateur & Admin)
# --------------------------------------------------------------------------
@router.get("/groups", response_model=list[str])
def get_attendance_groups(session: SessionDep, current_user: CurrentUser):
    if current_user.role not in ["formateur"] + ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé."
        )

    results = (
        session.query(User.group_name)
        .filter(
            User.role.in_(["étudiant", "stagiaire", "employer"]),
            User.group_name.isnot(None),
        )
        .distinct()
        .all()
    )
    return sorted(list({r[0] for r in results if r[0]}))


@router.get("/learners", response_model=list[UserSimpleOut])
def get_learners_for_attendance(
    session: SessionDep, current_user: CurrentUser, group_name: str | None = Query(None)
):
    if current_user.role not in ["formateur"] + ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les formateurs et administrateurs peuvent accéder à la liste des apprenants.",
        )

    query = session.query(User).filter(
        User.role.in_(["étudiant", "stagiaire", "employer"])
    )
    if group_name and group_name != "all":
        query = query.filter(User.group_name == group_name)

    learners = query.order_by(User.group_name.asc(), User.email.asc()).all()
    return learners


@router.post("/learners", response_model=UserSimpleOut)
def add_learner_to_group(payload: dict, session: SessionDep, current_user: CurrentUser):
    if current_user.role not in ["formateur"] + ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé."
        )

    email = payload.get("email", "").strip().lower()
    role = payload.get("role", "étudiant")
    group_name = payload.get("group_name", "Groupe A - Informatique & IA").strip()

    if not email:
        raise HTTPException(status_code=400, detail="L'adresse email est obligatoire.")

    existing = session.query(User).filter(User.email == email).first()
    if existing:
        existing.group_name = group_name
        existing.role = role
        session.commit()
        session.refresh(existing)
        return existing

    from app.core.security import get_password_hash

    new_user = User(
        email=email,
        hashed_password=get_password_hash("password123"),
        role=role,
        group_name=group_name,
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    return new_user


# --------------------------------------------------------------------------
# 3. GET ALL ATTENDANCE RECORDS (Strictly Formateur & Admin)
# --------------------------------------------------------------------------
@router.get("/", response_model=list[AttendanceOut])
def get_attendance_records(
    session: SessionDep,
    current_user: CurrentUser,
    target_date: date | None = Query(None),
    user_id: int | None = Query(None),
    status_filter: str | None = Query(None),
):
    if current_user.role not in ["formateur"] + ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès interdit : seuls les formateurs et administrateurs peuvent consulter la feuille d'émargement globale.",
        )

    query = session.query(Attendance)
    if target_date:
        query = query.filter(Attendance.date == target_date)
    if user_id:
        query = query.filter(Attendance.user_id == user_id)
    if status_filter:
        query = query.filter(Attendance.status == status_filter)

    records = query.order_by(Attendance.date.desc(), Attendance.id.desc()).all()
    return records


# --------------------------------------------------------------------------
# 4. BATCH RECORD ATTENDANCE (Strictly Formateur & Admin)
# --------------------------------------------------------------------------
@router.post("/batch", response_model=list[AttendanceOut])
def batch_record_attendance(
    payload: AttendanceBatchCreate, session: SessionDep, current_user: CurrentUser
):
    if current_user.role not in ["formateur"] + ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé : Seuls les formateurs et administrateurs peuvent pointer les présences.",
        )

    saved_records = []
    for item in payload.records:
        existing = (
            session.query(Attendance)
            .filter(
                Attendance.user_id == item.user_id,
                Attendance.date == payload.date,
                Attendance.session_name == payload.session_name,
            )
            .first()
        )

        if existing:
            existing.status = item.status
            existing.minutes_late = item.minutes_late if item.status == "late" else 0
            existing.remarks = item.remarks
            existing.marked_by_id = current_user.id
            saved_records.append(existing)
        else:
            new_record = Attendance(
                user_id=item.user_id,
                marked_by_id=current_user.id,
                date=payload.date,
                status=item.status,
                minutes_late=item.minutes_late if item.status == "late" else 0,
                session_name=payload.session_name,
                remarks=item.remarks,
            )
            session.add(new_record)
            saved_records.append(new_record)

    session.commit()
    for r in saved_records:
        session.refresh(r)

    return saved_records


# --------------------------------------------------------------------------
# 5. SINGLE RECORD ATTENDANCE (Strictly Formateur & Admin)
# --------------------------------------------------------------------------
@router.post("/", response_model=AttendanceOut)
def record_single_attendance(
    payload: AttendanceCreate, session: SessionDep, current_user: CurrentUser
):
    if current_user.role not in ["formateur"] + ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé."
        )

    new_record = Attendance(
        user_id=payload.user_id,
        marked_by_id=current_user.id,
        date=payload.date,
        status=payload.status,
        minutes_late=payload.minutes_late if payload.status == "late" else 0,
        session_name=payload.session_name,
        remarks=payload.remarks,
    )
    session.add(new_record)
    session.commit()
    session.refresh(new_record)
    return new_record


# --------------------------------------------------------------------------
# 6. DELETE ATTENDANCE (Strictly Formateur & Admin)
# --------------------------------------------------------------------------
@router.delete("/{attendance_id}")
def delete_attendance(
    attendance_id: int, session: SessionDep, current_user: CurrentUser
):
    if current_user.role not in ["formateur"] + ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé."
        )

    record = session.query(Attendance).filter(Attendance.id == attendance_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Enregistrement introuvable.")

    session.delete(record)
    session.commit()
    return {"message": "Enregistrement supprimé avec succès."}


# --------------------------------------------------------------------------
# 7. GLOBAL OVERVIEW (Strictly Formateur & Admin)
# --------------------------------------------------------------------------
@router.get("/overview", response_model=GlobalAttendanceOverview)
def get_attendance_global_overview(session: SessionDep, current_user: CurrentUser):
    if current_user.role not in ["formateur"] + ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé."
        )

    today = date.today()
    total_records = session.query(Attendance).count()
    total_students = (
        session.query(User)
        .filter(User.role.in_(["étudiant", "stagiaire", "employer"]))
        .count()
    )

    today_records = session.query(Attendance).filter(Attendance.date == today).all()
    today_present = sum(1 for r in today_records if r.status == "present")
    today_late = sum(1 for r in today_records if r.status == "late")
    today_absent = sum(1 for r in today_records if r.status == "absent")

    today_total = len(today_records)
    today_rate = (
        round(((today_present + today_late) / today_total) * 100, 1)
        if today_total > 0
        else 100.0
    )

    month_start = today.replace(day=1)
    month_records = (
        session.query(Attendance).filter(Attendance.date >= month_start).all()
    )
    month_present = sum(1 for r in month_records if r.status in ["present", "late"])
    month_total = len(month_records)
    month_rate = (
        round((month_present / month_total) * 100, 1) if month_total > 0 else 100.0
    )

    return GlobalAttendanceOverview(
        total_records=total_records,
        total_students=total_students,
        today_present=today_present,
        today_late=today_late,
        today_absent=today_absent,
        today_attendance_rate=today_rate,
        monthly_attendance_rate=month_rate,
    )
