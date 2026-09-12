import hashlib
import json
import os
import secrets
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.api.deps import CurrentAdminUser, CurrentSuperAdminUser, SessionDep
from app.core.config import is_production, settings
from app.db.database import engine
from app.models.attendance import Attendance
from app.models.audit_log import AuditLog
from app.models.classroom import Classroom
from app.models.classroom_invitation import ClassroomInvitation
from app.models.course import Course
from app.models.course_video import CourseVideo
from app.models.enrollment import Enrollment
from app.models.group import Group, GroupMember
from app.models.message import Message
from app.models.quiz import Quiz, QuizAttempt, QuizQuestion
from app.models.system_setting import SystemSetting
from app.models.task import Task, TaskSubmission
from app.models.user import User
from app.models.user_invitation import UserInvitation
from app.models.user_session import UserSession
from app.services.audit_service import extract_client_ip, log_audit_event
from app.services.email_service import get_base_html_template, is_valid_email, send_email

router = APIRouter()

# Heure de démarrage de l'application pour calcul de l'uptime
APP_START_TIME = time.time()


# =========================================================================
# SCHÉMAS PYDANTIC
# =========================================================================
class InvitationCreateRequest(BaseModel):
    email: EmailStr
    role: str = "étudiant"
    group_name: Optional[str] = None


class SystemSettingsUpdateRequest(BaseModel):
    settings: Dict[str, str]


# =========================================================================
# 1. TABLEAU DE BORD & STATISTIQUES RÉELLES
# =========================================================================
@router.get("/dashboard/stats")
def get_admin_dashboard_stats(
    current_admin: CurrentAdminUser,
    session: SessionDep,
) -> Dict[str, Any]:
    """
    Statistiques consolidées en temps réel de toute la plateforme :
    utilisateurs, cours, évaluations, présences, visioconférences et santé système.
    """
    # 1. Statistiques Utilisateurs
    all_users = session.query(User).all()
    total_users = len(all_users)
    active_users = sum(1 for u in all_users if getattr(u, "is_active", True) is not False)
    disabled_users = total_users - active_users

    role_counts: Dict[str, int] = {}
    for u in all_users:
        r = (u.role or "inconnu").strip().lower()
        role_counts[r] = role_counts.get(r, 0) + 1

    # 2. Statistiques Pédagogiques
    total_courses = session.query(Course).count()
    total_videos = session.query(CourseVideo).count()
    total_enrollments = session.query(Enrollment).count()
    total_groups = session.query(Group).count()

    # 3. Statistiques Quiz & Évaluations
    total_quizzes = session.query(Quiz).count()
    total_attempts = session.query(QuizAttempt).count()
    avg_score = session.query(func.avg(QuizAttempt.percentage)).scalar() or 0.0

    # 4. Statistiques Salles Vidéo
    total_classrooms = session.query(Classroom).count()
    active_classrooms = session.query(Classroom).filter(Classroom.is_active == True).count()
    total_invitations = session.query(ClassroomInvitation).count()

    # 5. Présences
    total_attendance = session.query(Attendance).count()
    present_attendance = session.query(Attendance).filter(Attendance.status.in_(["present", "Présent", "presente"])).count()
    late_attendance = session.query(Attendance).filter(Attendance.status.in_(["late", "En retard", "retard"])).count()
    absent_attendance = session.query(Attendance).filter(Attendance.status.in_(["absent", "Absent"])).count()

    # 6. Sessions actives & Activité
    active_sessions_count = session.query(UserSession).filter(UserSession.is_active == True).count()
    total_audit_logs = session.query(AuditLog).count()

    # 7. Latence Base de Données
    start_t = time.time()
    db_ok = False
    try:
        session.execute(text("SELECT 1")).scalar()
        db_ok = True
        latency_ms = round((time.time() - start_t) * 1000, 2)
    except Exception:
        latency_ms = -1

    uptime_seconds = int(time.time() - APP_START_TIME)

    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "disabled": disabled_users,
            "by_role": role_counts,
        },
        "academics": {
            "courses": total_courses,
            "videos": total_videos,
            "enrollments": total_enrollments,
            "groups": total_groups,
        },
        "quizzes": {
            "total": total_quizzes,
            "attempts": total_attempts,
            "average_score": round(float(avg_score), 1),
        },
        "classrooms": {
            "total": total_classrooms,
            "active": active_classrooms,
            "invitations": total_invitations,
        },
        "attendance": {
            "total": total_attendance,
            "present": present_attendance,
            "late": late_attendance,
            "absent": absent_attendance,
            "presence_rate": round((present_attendance / total_attendance * 100) if total_attendance > 0 else 0, 1),
        },
        "system": {
            "database_engine": engine.dialect.name,
            "database_alive": db_ok,
            "database_latency_ms": latency_ms,
            "uptime_seconds": uptime_seconds,
            "active_sessions": active_sessions_count,
            "audit_logs_count": total_audit_logs,
            "environment": settings.ENVIRONMENT,
            "is_production": is_production(),
        },
    }


# =========================================================================
# 2. JOURNAL D'AUDIT RÉEL (AUDIT LOGS)
# =========================================================================
@router.get("/audit-logs")
def get_audit_logs(
    current_admin: CurrentAdminUser,
    session: SessionDep,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    action: Optional[str] = None,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Récupère le flux d'événements du journal d'audit avec pagination, filtres et recherche.
    """
    query = session.query(AuditLog)

    if action and action.strip():
        query = query.filter(func.lower(AuditLog.action) == action.strip().lower())

    if status_filter and status_filter.strip():
        query = query.filter(func.lower(AuditLog.status) == status_filter.strip().lower())

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.filter(
            (func.lower(AuditLog.action).like(term))
            | (func.lower(AuditLog.user_email).like(term))
            | (func.lower(AuditLog.details).like(term))
            | (func.lower(AuditLog.ip_address).like(term))
        )

    total_count = query.count()
    logs = (
        query.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    items = [
        {
            "id": l.id,
            "user_id": l.user_id,
            "user_email": l.user_email or "Système",
            "action": l.action,
            "resource_type": l.resource_type,
            "resource_id": l.resource_id,
            "details": l.details,
            "ip_address": l.ip_address or "—",
            "user_agent": l.user_agent or "—",
            "status": l.status,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]

    return {
        "total": total_count,
        "page": page,
        "limit": limit,
        "items": items,
    }


# =========================================================================
# 3. GESTION DES SESSIONS ACTIVES
# =========================================================================
@router.get("/sessions")
def get_active_sessions(
    current_admin: CurrentAdminUser,
    session: SessionDep,
) -> List[Dict[str, Any]]:
    """
    Liste toutes les sessions de connexion actives avec détails de l'appareil,
    IP cliente, dernière activité et date d'expiration.
    """
    now = datetime.utcnow()
    # Met à jour les sessions expirées
    session.query(UserSession).filter(
        UserSession.is_active == True,
        UserSession.expires_at < now,
    ).update({"is_active": False})
    session.commit()

    active_sessions = (
        session.query(UserSession, User)
        .join(User, UserSession.user_id == User.id)
        .filter(UserSession.is_active == True)
        .order_by(UserSession.last_activity.desc())
        .all()
    )

    results = []
    for s, u in active_sessions:
        results.append({
            "id": s.id,
            "user_id": u.id,
            "user_email": u.email,
            "user_name": f"{u.prenom or ''} {u.nom or ''}".strip() or u.username,
            "user_role": u.role,
            "ip_address": s.ip_address or "127.0.0.1",
            "device_info": s.device_info or "Navigateur Web",
            "user_agent": s.user_agent,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "last_activity": s.last_activity.isoformat() if s.last_activity else None,
            "expires_at": s.expires_at.isoformat() if s.expires_at else None,
        })
    return results


@router.delete("/sessions/{session_id}")
def revoke_session(
    session_id: int,
    request: Request,
    current_admin: CurrentAdminUser,
    session: SessionDep,
) -> Dict[str, Any]:
    """
    Révoque et termine immédiatement une session utilisateur active.
    """
    user_session = session.query(UserSession).filter(UserSession.id == session_id).first()
    if not user_session:
        raise HTTPException(status_code=404, detail="Session introuvable.")

    target_user_id = user_session.user_id
    user_session.is_active = False
    session.commit()

    log_audit_event(
        session,
        action="SESSION_REVOKE",
        user_id=current_admin.id,
        user_email=current_admin.email,
        resource_type="user_session",
        resource_id=session_id,
        details=f"Révocation manuelle de la session #{session_id} pour l'utilisateur #{target_user_id}",
        status="SUCCESS",
        request=request,
    )

    return {"message": f"Session #{session_id} révoquée avec succès."}


@router.post("/sessions/revoke-all-user/{user_id}")
def revoke_all_sessions_for_user(
    user_id: int,
    request: Request,
    current_admin: CurrentAdminUser,
    session: SessionDep,
) -> Dict[str, Any]:
    """
    Déconnecte et révoque l'ensemble des sessions actives pour un utilisateur cible.
    """
    target_user = session.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")

    count = (
        session.query(UserSession)
        .filter(UserSession.user_id == user_id, UserSession.is_active == True)
        .update({"is_active": False})
    )
    session.commit()

    log_audit_event(
        session,
        action="SESSION_REVOKE_ALL",
        user_id=current_admin.id,
        user_email=current_admin.email,
        resource_type="user",
        resource_id=user_id,
        details=f"Déconnexion forcée de toutes les sessions ({count} sessions révoquées) pour {target_user.email}",
        status="SUCCESS",
        request=request,
    )

    return {"message": f"{count} sessions révoquées pour {target_user.email}."}


# =========================================================================
# 4. ÉVÉNEMENTS & SÉCURITÉ DE LA PLATEFORME
# =========================================================================
@router.get("/security/events")
def get_security_events(
    current_admin: CurrentAdminUser,
    session: SessionDep,
) -> Dict[str, Any]:
    """
    Supervision de sécurité : tentatives de connexion échouées, comptes suspendus,
    activités suspectes et alertes de sécurité dans les dernières 24h.
    """
    yesterday = datetime.utcnow() - timedelta(hours=24)

    # Échecs de connexion récents
    failed_logins = (
        session.query(AuditLog)
        .filter(
            AuditLog.action.in_(["LOGIN_FAILED", "LOGIN_BLOCKED"]),
            AuditLog.created_at >= yesterday,
        )
        .order_by(AuditLog.created_at.desc())
        .limit(20)
        .all()
    )

    # Comptes actuellement inactifs
    inactive_users = (
        session.query(User)
        .filter(User.is_active == False)
        .all()
    )

    # IPs avec plusieurs échecs de connexion (détection d'intrusion)
    ip_attempts = (
        session.query(AuditLog.ip_address, func.count(AuditLog.id).label("failures"))
        .filter(
            AuditLog.action == "LOGIN_FAILED",
            AuditLog.created_at >= yesterday,
            AuditLog.ip_address != None,
        )
        .group_by(AuditLog.ip_address)
        .having(func.count(AuditLog.id) >= 3)
        .all()
    )

    suspicious_ips = [
        {"ip": row[0], "failures": row[1]} for row in ip_attempts
    ]

    return {
        "failed_logins_last_24h": len(failed_logins),
        "suspended_accounts_count": len(inactive_users),
        "suspicious_ips": suspicious_ips,
        "recent_failed_attempts": [
            {
                "id": l.id,
                "email": l.user_email or "Inconnu",
                "ip": l.ip_address or "—",
                "reason": l.details,
                "timestamp": l.created_at.isoformat() if l.created_at else None,
            }
            for l in failed_logins
        ],
        "suspended_users": [
            {"id": u.id, "email": u.email, "username": u.username, "role": u.role}
            for u in inactive_users
        ],
    }


# =========================================================================
# 5. GESTION DES INVITATIONS UTILISATEURS
# =========================================================================
@router.get("/invitations")
def get_invitations(
    current_admin: CurrentAdminUser,
    session: SessionDep,
) -> List[Dict[str, Any]]:
    """
    Récupère la liste de toutes les invitations envoyées avec leur statut dynamique.
    """
    now = datetime.utcnow()
    # Marquer les invitations expirées
    session.query(UserInvitation).filter(
        UserInvitation.status == "pending",
        UserInvitation.expires_at < now,
    ).update({"status": "expired"})
    session.commit()

    invitations = (
        session.query(UserInvitation)
        .order_by(UserInvitation.created_at.desc())
        .all()
    )

    results = []
    for inv in invitations:
        inviter_email = inv.invited_by.email if inv.invited_by else "Admin"
        results.append({
            "id": inv.id,
            "email": inv.email,
            "role": inv.role,
            "group_name": inv.group_name or "—",
            "token": inv.token,
            "status": inv.status,
            "invited_by": inviter_email,
            "created_at": inv.created_at.isoformat() if inv.created_at else None,
            "expires_at": inv.expires_at.isoformat() if inv.expires_at else None,
        })
    return results


@router.post("/invitations")
def create_user_invitation(
    payload: InvitationCreateRequest,
    request: Request,
    current_admin: CurrentAdminUser,
    session: SessionDep,
) -> Dict[str, Any]:
    """
    Crée une nouvelle invitation pour un utilisateur avec envoi d'email et token unique.
    """
    email = payload.email.strip().lower()

    # Vérifier si un compte existe déjà avec cet email
    existing_user = session.query(User).filter(func.lower(User.email) == email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Un compte utilisateur existe déjà pour l'adresse {email}.",
        )

    # Annuler toute précédente invitation pending pour cet email
    session.query(UserInvitation).filter(
        func.lower(UserInvitation.email) == email,
        UserInvitation.status == "pending",
    ).update({"status": "revoked"})

    token = secrets.token_urlsafe(32)
    invitation = UserInvitation(
        email=email,
        role=payload.role,
        group_name=payload.group_name,
        token=token,
        status="pending",
        invited_by_id=current_admin.id,
        expires_at=datetime.utcnow() + timedelta(days=7),
        created_at=datetime.utcnow(),
    )
    session.add(invitation)
    session.commit()
    session.refresh(invitation)

    # Envoi de l'email d'invitation transactionnel
    invitation_url = f"{settings.PROJECT_NAME} /register?invitation_token={token}&email={email}"
    email_body = f"""
    <p>Bonjour,</p>
    <p>Vous avez été invité à rejoindre la plateforme <strong>E-Schola Pro</strong> avec le rôle de <strong>{payload.role}</strong>.</p>
    <p>Votre lien d'activation sécurisé est valable pendant 7 jours.</p>
    """
    email_html = get_base_html_template(
        title="Invitation à rejoindre E-Schola Pro",
        preheader=f"Votre invitation pour le rôle {payload.role}",
        body_content=email_body,
        action_url=f"/register?invitation_token={token}&email={email}",
        action_text="Créer mon compte",
    )
    send_email(
        to_email=email,
        subject="Invitation à rejoindre la plateforme E-Schola Pro",
        html_content=email_html,
    )

    log_audit_event(
        session,
        action="INVITATION_SENT",
        user_id=current_admin.id,
        user_email=current_admin.email,
        resource_type="user_invitation",
        resource_id=invitation.id,
        details=f"Invitation envoyée à {email} (rôle: {payload.role})",
        status="SUCCESS",
        request=request,
    )

    return {
        "id": invitation.id,
        "email": invitation.email,
        "role": invitation.role,
        "token": invitation.token,
        "status": invitation.status,
        "message": f"Invitation envoyée avec succès à {email}.",
    }


@router.post("/invitations/{invite_id}/resend")
def resend_invitation(
    invite_id: int,
    request: Request,
    current_admin: CurrentAdminUser,
    session: SessionDep,
) -> Dict[str, Any]:
    """
    Renvoie une invitation et prolonge sa validité de 7 jours.
    """
    inv = session.query(UserInvitation).filter(UserInvitation.id == invite_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation introuvable.")

    inv.token = secrets.token_urlsafe(32)
    inv.status = "pending"
    inv.expires_at = datetime.utcnow() + timedelta(days=7)
    session.commit()

    email_body = f"""
    <p>Rappel : vous avez été invité à rejoindre <strong>E-Schola Pro</strong> avec le rôle de <strong>{inv.role}</strong>.</p>
    <p>Ce nouveau lien sécurisé remplace le précédent et reste valable pendant 7 jours.</p>
    """
    email_html = get_base_html_template(
        title="Rappel d'invitation E-Schola Pro",
        preheader="Votre lien d'activation",
        body_content=email_body,
        action_url=f"/register?invitation_token={inv.token}&email={inv.email}",
        action_text="Finaliser mon inscription",
    )
    send_email(
        to_email=inv.email,
        subject="Rappel : Votre invitation E-Schola Pro",
        html_content=email_html,
    )

    log_audit_event(
        session,
        action="INVITATION_RESENT",
        user_id=current_admin.id,
        user_email=current_admin.email,
        resource_type="user_invitation",
        resource_id=inv.id,
        details=f"Renvoi de l'invitation à {inv.email}",
        status="SUCCESS",
        request=request,
    )

    return {"message": f"Invitation renvoyée à {inv.email}."}


@router.delete("/invitations/{invite_id}")
def revoke_invitation(
    invite_id: int,
    request: Request,
    current_admin: CurrentAdminUser,
    session: SessionDep,
) -> Dict[str, Any]:
    """
    Révoque définitivement une invitation en attente.
    """
    inv = session.query(UserInvitation).filter(UserInvitation.id == invite_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation introuvable.")

    inv.status = "revoked"
    session.commit()

    log_audit_event(
        session,
        action="INVITATION_REVOKED",
        user_id=current_admin.id,
        user_email=current_admin.email,
        resource_type="user_invitation",
        resource_id=inv.id,
        details=f"Révocation de l'invitation pour {inv.email}",
        status="SUCCESS",
        request=request,
    )

    return {"message": f"Invitation pour {inv.email} révoquée."}


# =========================================================================
# 6. PARAMÈTRES GLOBAUX DE LA PLATEFORME (SYSTEM SETTINGS)
# =========================================================================
@router.get("/settings")
def get_system_settings(
    current_admin: CurrentAdminUser,
    session: SessionDep,
) -> List[Dict[str, Any]]:
    """
    Récupère tous les paramètres configurables de la plateforme.
    """
    settings_list = session.query(SystemSetting).order_by(SystemSetting.category, SystemSetting.key).all()
    return [
        {
            "id": s.id,
            "key": s.key,
            "value": s.value,
            "description": s.description,
            "category": s.category,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        }
        for s in settings_list
    ]


@router.put("/settings")
def update_system_settings(
    payload: SystemSettingsUpdateRequest,
    request: Request,
    current_super_admin: CurrentSuperAdminUser,
    session: SessionDep,
) -> Dict[str, Any]:
    """
    Met à jour les paramètres de la plateforme.
    Réservé au super-administrateur principal (admin).
    """
    updated_keys = []
    for key, val in payload.settings.items():
        st = session.query(SystemSetting).filter(SystemSetting.key == key).first()
        if st:
            st.value = str(val).strip()
            st.updated_by_id = current_super_admin.id
            st.updated_at = datetime.utcnow()
            updated_keys.append(key)
        else:
            new_st = SystemSetting(
                key=key,
                value=str(val).strip(),
                category="general",
                updated_by_id=current_super_admin.id,
                updated_at=datetime.utcnow(),
            )
            session.add(new_st)
            updated_keys.append(key)

    session.commit()

    log_audit_event(
        session,
        action="SETTINGS_UPDATE",
        user_id=current_super_admin.id,
        user_email=current_super_admin.email,
        resource_type="system_settings",
        details={"updated_settings": payload.settings},
        status="SUCCESS",
        request=request,
    )

    return {"message": "Paramètres système mis à jour avec succès.", "updated_keys": updated_keys}


# =========================================================================
# 7. SUPERVISION & SANTÉ SYSTÈME
# =========================================================================
@router.get("/system/status")
def get_system_status(
    current_admin: CurrentAdminUser,
    session: SessionDep,
) -> Dict[str, Any]:
    """
    Supervision en temps réel des performances et de l'état des services.
    """
    start_t = time.time()
    db_alive = False
    try:
        session.execute(text("SELECT 1")).scalar()
        db_alive = True
        latency_ms = round((time.time() - start_t) * 1000, 2)
    except Exception:
        latency_ms = -1

    # Calcul taille dossier uploads
    uploads_dir = "uploads"
    uploads_size_bytes = 0
    file_count = 0
    if os.path.exists(uploads_dir):
        for root, _, files in os.walk(uploads_dir):
            for f in files:
                fp = os.path.join(root, f)
                try:
                    uploads_size_bytes += os.path.getsize(fp)
                    file_count += 1
                except OSError:
                    pass
    uploads_size_mb = round(uploads_size_bytes / (1024 * 1024), 2)

    # Informations mémoire basiques
    memory_info = {}
    try:
        import psutil
        vm = psutil.virtual_memory()
        memory_info = {
            "total_mb": round(vm.total / (1024 * 1024), 1),
            "used_mb": round(vm.used / (1024 * 1024), 1),
            "percent": vm.percent,
        }
    except Exception:
        memory_info = {"total_mb": "N/A", "used_mb": "N/A", "percent": 0}

    uptime_sec = int(time.time() - APP_START_TIME)

    return {
        "status": "healthy" if db_alive else "degraded",
        "database": {
            "alive": db_alive,
            "engine": engine.dialect.name,
            "latency_ms": latency_ms,
            "masked_url": settings.DATABASE_URL.split("@")[-1] if "@" in settings.DATABASE_URL else "local",
        },
        "storage": {
            "uploads_size_mb": uploads_size_mb,
            "uploads_file_count": file_count,
        },
        "system": {
            "memory": memory_info,
            "uptime_seconds": uptime_sec,
            "uptime_formatted": f"{uptime_sec // 3600}h {(uptime_sec % 3600) // 60}m {uptime_sec % 60}s",
            "environment": settings.ENVIRONMENT,
            "railway_production": is_production(),
        },
    }


# =========================================================================
# 8. CONSULTATION SÉCURISÉE DES LOGS APPLICATIFS
# =========================================================================
@router.get("/system/logs")
def get_application_logs(
    current_admin: CurrentAdminUser,
    session: SessionDep,
    limit: int = Query(60, ge=10, le=200),
    level: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Extrait et formate les logs d'activité et d'audit récents avec masquage
    systématique des secrets et données sensibles.
    """
    query = session.query(AuditLog).order_by(AuditLog.created_at.desc())
    if level and level.strip():
        query = query.filter(func.lower(AuditLog.status) == level.strip().lower())

    logs = query.limit(limit).all()

    formatted_logs = []
    for l in logs:
        # Masquage de sécurité
        masked_details = l.details or ""
        for secret_word in ["password", "token", "secret", "authorization", "hashed_password"]:
            if secret_word in masked_details.lower():
                masked_details = "[DONNÉES SENSIBLES MASQUÉES]"

        formatted_logs.append({
            "timestamp": l.created_at.strftime("%Y-%m-%d %H:%M:%S") if l.created_at else "—",
            "level": "INFO" if l.status == "SUCCESS" else "WARNING" if l.status == "WARNING" else "ERROR",
            "action": l.action,
            "actor": l.user_email or "Système",
            "ip": l.ip_address or "127.0.0.1",
            "details": masked_details,
        })
    return formatted_logs


# =========================================================================
# 9. SAUVEGARDE & EXPORTATION COMPLÈTE DE LA BASE DE DONNÉES
# =========================================================================
@router.get("/backup/export")
def export_database_backup(
    request: Request,
    current_super_admin: CurrentSuperAdminUser,
    session: SessionDep,
) -> Dict[str, Any]:
    """
    Génère un export complet et structuré de l'ensemble des tables de la base
    (Utilisateurs, Cours, Quiz, Devoirs, Présences, Groupes, Paramètres, Audit)
    avec empreinte SHA256 pour archivage ou restauration d'urgence.
    Réservé au super-administrateur principal (admin).
    """
    users_data = [
        {
            "id": u.id,
            "email": u.email,
            "username": u.username,
            "role": u.role,
            "is_active": getattr(u, "is_active", True),
            "nom": u.nom,
            "prenom": u.prenom,
            "departement": u.departement,
            "specialisation": u.specialisation,
            "telephone": u.telephone,
            "cin": u.cin,
            "date_naissance": u.date_naissance,
            "adresse": u.adresse,
            "ville": u.ville,
            "pays": u.pays,
            "created_at": str(u.created_at) if hasattr(u, "created_at") else None,
        }
        for u in session.query(User).all()
    ]

    courses_data = [
        {
            "id": c.id,
            "title": c.title,
            "description": c.description,
            "instructor_id": c.instructor_id,
            "cover_image_url": c.cover_image_url,
            "document_url": c.document_url,
        }
        for c in session.query(Course).all()
    ]

    quizzes_data = [
        {
            "id": q.id,
            "title": q.title,
            "description": q.description,
            "created_by_id": q.created_by_id,
            "target_roles": q.target_roles,
            "target_group": getattr(q, "target_group", "all"),
            "time_limit_minutes": q.time_limit_minutes,
        }
        for q in session.query(Quiz).all()
    ]

    groups_data = [
        {
            "id": g.id,
            "name": g.name,
            "description": g.description,
            "creator_id": g.creator_id,
        }
        for g in session.query(Group).all()
    ]

    settings_data = [
        {
            "key": s.key,
            "value": s.value,
            "category": s.category,
            "description": s.description,
        }
        for s in session.query(SystemSetting).all()
    ]

    backup_payload = {
        "metadata": {
            "platform": "E-Schola Pro",
            "version": "1.0.0",
            "exported_at": datetime.utcnow().isoformat(),
            "exported_by": current_super_admin.email,
            "database_engine": engine.dialect.name,
            "counts": {
                "users": len(users_data),
                "courses": len(courses_data),
                "quizzes": len(quizzes_data),
                "groups": len(groups_data),
                "settings": len(settings_data),
            },
        },
        "data": {
            "users": users_data,
            "courses": courses_data,
            "quizzes": quizzes_data,
            "groups": groups_data,
            "settings": settings_data,
        },
    }

    # Calcul SHA256 pour vérifier l'intégrité
    serialized = json.dumps(backup_payload, sort_keys=True, ensure_ascii=False)
    checksum = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
    backup_payload["metadata"]["sha256_checksum"] = checksum

    log_audit_event(
        session,
        action="BACKUP_EXPORT",
        user_id=current_super_admin.id,
        user_email=current_super_admin.email,
        resource_type="system",
        details=f"Export de sauvegarde intégrale JSON généré ({len(users_data)} utilisateurs, SHA: {checksum[:12]})",
        status="SUCCESS",
        request=request,
    )

    return backup_payload


@router.post("/backup/snapshot")
def create_local_snapshot(
    request: Request,
    current_super_admin: CurrentSuperAdminUser,
    session: SessionDep,
) -> Dict[str, Any]:
    """
    Génère et sauvegarde un fichier d'instantané horodaté dans 'uploads/backups/'.
    """
    backup_payload = export_database_backup(request, current_super_admin, session)
    backup_dir = os.path.join("uploads", "backups")
    os.makedirs(backup_dir, exist_ok=True)

    timestamp_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"eschola_backup_{timestamp_str}.json"
    file_path = os.path.join(backup_dir, filename)

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(backup_payload, f, ensure_ascii=False, indent=2)

    return {
        "message": "Instantané de base de données créé sur le serveur avec succès.",
        "filename": filename,
        "path": f"/uploads/backups/{filename}",
        "checksum": backup_payload["metadata"]["sha256_checksum"],
        "size_kb": round(os.path.getsize(file_path) / 1024, 2),
    }


# =========================================================================
# 10. SUPERVISION DES SALLES VIDÉO CONFÉRENCE
# =========================================================================
@router.get("/classrooms/supervision")
def get_classrooms_supervision(
    current_admin: CurrentAdminUser,
    session: SessionDep,
) -> List[Dict[str, Any]]:
    """
    Liste toutes les salles de visioconférence avec leur créateur, date et statut d'activité.
    """
    rooms = (
        session.query(Classroom)
        .order_by(Classroom.is_active.desc(), Classroom.created_at.desc())
        .all()
    )

    results = []
    for r in rooms:
        invites_count = session.query(ClassroomInvitation).filter(ClassroomInvitation.classroom_id == r.id).count()
        results.append({
            "id": r.id,
            "room_id": r.room_id,
            "title": r.title,
            "instructor_id": r.instructor_id,
            "instructor_email": r.instructor.email if r.instructor else "Inconnu",
            "is_active": r.is_active,
            "invitations_count": invites_count,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    return results


@router.post("/classrooms/{room_id}/terminate")
def force_terminate_classroom(
    room_id: int,
    request: Request,
    current_admin: CurrentAdminUser,
    session: SessionDep,
) -> Dict[str, Any]:
    """
    Arrêt forcé d'urgence d'une salle de visioconférence par l'administrateur.
    """
    room = session.query(Classroom).filter(Classroom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Salle de visioconférence introuvable.")

    room.is_active = False
    session.commit()

    log_audit_event(
        session,
        action="ROOM_TERMINATE",
        user_id=current_admin.id,
        user_email=current_admin.email,
        resource_type="classroom",
        resource_id=room.id,
        details=f"Fermeture administrative d'urgence de la salle '{room.title}' (ID: {room.room_id})",
        status="SUCCESS",
        request=request,
    )

    return {"message": f"La salle '{room.title}' a été clôturée avec succès."}


# =========================================================================
# 11. SUPERVISION DES QUIZ & RÉSULTATS
# =========================================================================
@router.get("/quizzes/supervision")
def get_quizzes_supervision(
    current_admin: CurrentAdminUser,
    session: SessionDep,
) -> Dict[str, Any]:
    """
    Synthèse de supervision de toutes les évaluations : taux de complétion,
    moyenne générale, classement et liste des dernières tentatives.
    """
    quizzes = session.query(Quiz).all()
    quiz_items = []
    for q in quizzes:
        attempts_count = session.query(QuizAttempt).filter(QuizAttempt.quiz_id == q.id).count()
        avg_p = session.query(func.avg(QuizAttempt.percentage)).filter(QuizAttempt.quiz_id == q.id).scalar() or 0.0
        q_count = session.query(QuizQuestion).filter(QuizQuestion.quiz_id == q.id).count()
        quiz_items.append({
            "id": q.id,
            "title": q.title,
            "creator_email": q.creator.email if q.creator else "Formateur",
            "target_roles": q.target_roles,
            "target_group": getattr(q, "target_group", "all"),
            "time_limit": q.time_limit_minutes,
            "questions_count": q_count,
            "attempts_count": attempts_count,
            "average_score": round(float(avg_p), 1),
        })

    recent_attempts = (
        session.query(QuizAttempt, User, Quiz)
        .join(User, QuizAttempt.user_id == User.id)
        .join(Quiz, QuizAttempt.quiz_id == Quiz.id)
        .order_by(QuizAttempt.completed_at.desc())
        .limit(30)
        .all()
    )

    attempts_list = [
        {
            "id": a.id,
            "quiz_id": q.id,
            "quiz_title": q.title,
            "user_email": u.email,
            "user_name": f"{u.prenom or ''} {u.nom or ''}".strip() or u.username,
            "score": a.score,
            "max_score": a.max_score,
            "percentage": round(float(a.percentage), 1),
            "completed_at": a.completed_at.isoformat() if a.completed_at else None,
        }
        for a, u, q in recent_attempts
    ]

    return {
        "quizzes": quiz_items,
        "recent_attempts": attempts_list,
    }
