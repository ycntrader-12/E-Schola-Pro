from typing import Any

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser, SessionDep
from app.core.sanitizer import sanitize_attachment_url
from app.models.event import Event, EventDeliverable
from app.schemas.event import (
    EventCreate,
    EventDeliverableCreate,
    EventDeliverableResponse,
    EventResponse,
    EventUpdate,
)

from app.core.roles import is_staff, matches_target_role, require_staff

router = APIRouter()


@router.get("/", response_model=list[EventResponse])
def read_events(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 200,
) -> Any:
    """
    Retrieve all planning and courses on the calendar (visible pour tous les utilisateurs).
    """
    events = (
        session.query(Event)
        .order_by(Event.start_time.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    if not is_staff(current_user):
        events = [e for e in events if matches_target_role(current_user.role, e.target_roles)]
    return events


@router.post("/", response_model=EventResponse)
def create_event(
    *,
    session: SessionDep,
    event_in: EventCreate,
    current_user: CurrentUser,
) -> Any:
    """
    Create a new calendar event / planning.
    Strictly restricted to Formateurs, DG/RH and Admins.
    """
    require_staff(
        current_user,
        "Seuls les formateurs, DG/RH et l'administrateur ont l'autorisation d'ajouter un planning ou un cours au calendrier.",
    )

    event = Event(
        title=event_in.title.strip(),
        description=event_in.description.strip() if event_in.description else "",
        start_time=event_in.start_time,
        end_time=event_in.end_time,
        target_roles=event_in.target_roles or "étudiant,stagiaire,employer",
    )
    session.add(event)
    session.commit()
    session.refresh(event)
    return event


@router.put("/{event_id}", response_model=EventResponse)
def update_event(
    event_id: int,
    *,
    session: SessionDep,
    event_in: EventUpdate,
    current_user: CurrentUser,
) -> Any:
    """
    Update an existing calendar event / planning.
    Strictly restricted to Formateurs and Admins.
    """
    require_staff(
        current_user,
        "Seuls les formateurs et l'administrateur ont l'autorisation de modifier un cours ou un planning.",
    )

    event = session.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Événement introuvable.")

    if event_in.title is not None:
        event.title = event_in.title.strip()
    if event_in.description is not None:
        event.description = event_in.description.strip()
    if event_in.start_time is not None:
        event.start_time = event_in.start_time
    if event_in.end_time is not None:
        event.end_time = event_in.end_time
    if event_in.target_roles is not None:
        event.target_roles = event_in.target_roles

    session.commit()
    session.refresh(event)
    return event


@router.delete("/{event_id}")
def delete_event(
    event_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Delete a calendar event / planning.
    Strictly restricted to Formateurs and Admins.
    """
    require_staff(
        current_user,
        "Seuls les formateurs et l'administrateur ont l'autorisation de supprimer un cours ou un planning.",
    )

    event = session.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Événement introuvable.")

    session.delete(event)
    session.commit()
    return {"message": "Cours / planning supprimé avec succès.", "id": event_id}


@router.post("/{event_id}/deliverables", response_model=EventDeliverableResponse)
def submit_deliverable(
    event_id: int,
    *,
    session: SessionDep,
    deliverable_in: EventDeliverableCreate,
    current_user: CurrentUser,
) -> Any:
    """
    Submit a deliverable (file or link) for a calendar event.
    """
    event = session.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Événement introuvable.")

    # Validate and sanitize submitted URLs
    clean_file_url = sanitize_attachment_url(deliverable_in.file_url) if deliverable_in.file_url else None
    clean_link_url = sanitize_attachment_url(deliverable_in.link_url) if deliverable_in.link_url else None

    if deliverable_in.file_url and not clean_file_url:
        raise HTTPException(status_code=400, detail="URL de fichier non sécurisée ou invalide.")
    if deliverable_in.link_url and not clean_link_url:
        raise HTTPException(status_code=400, detail="URL de lien non sécurisée ou protocole interdit.")
    if not clean_file_url and not clean_link_url:
        raise HTTPException(
            status_code=400, detail="Veuillez fournir un fichier ou un lien valide."
        )

    deliverable = EventDeliverable(
        event_id=event_id,
        user_id=current_user.id,
        file_url=clean_file_url,
        link_url=clean_link_url,
    )
    session.add(deliverable)
    session.commit()
    session.refresh(deliverable)
    return deliverable


@router.get("/{event_id}/deliverables", response_model=list[EventDeliverableResponse])
def get_deliverables(
    event_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Get deliverables for an event.
    Admins and formateurs see all. Students see only their own.
    """
    event = session.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Événement introuvable.")

    query = session.query(EventDeliverable).filter(
        EventDeliverable.event_id == event_id
    )

    if not is_staff(current_user):
        query = query.filter(EventDeliverable.user_id == current_user.id)

    # Eager load user to satisfy the schema
    from sqlalchemy.orm import joinedload

    query = query.options(joinedload(EventDeliverable.user))

    return query.all()
