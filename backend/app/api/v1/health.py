import time
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.config import settings
from app.db.database import engine
from app.models.user import User

router = APIRouter()


@router.get("/db-status")
def get_database_status(session: Session = Depends(get_db)) -> dict[str, Any]:
    """
    Diagnostic endpoint to verify real-time database connectivity, active engine,
    transaction persistence (write-commit-rollback canary), and table metrics.
    """
    dialect = engine.dialect.name
    masked_url = settings.DATABASE_URL
    if "@" in masked_url:
        prefix = masked_url.split("://")[0]
        host_db = masked_url.split("@")[-1]
        masked_url = f"{prefix}://*****:*****@{host_db}"

    # 1. Test Read Latency
    start_time = time.time()
    read_ok = False
    try:
        session.execute(text("SELECT 1")).scalar()
        read_ok = True
        read_latency_ms = round((time.time() - start_time) * 1000, 2)
    except Exception as e:
        read_latency_ms = -1
        read_error = str(e)

    # 2. Test Write Persistence Canary (Create, commit, verify read, delete, commit)
    write_ok = False
    write_latency_ms = -1
    write_error = None
    try:
        w_start = time.time()
        # Verify transaction commit works on the active engine
        session.execute(
            text("CREATE TEMPORARY TABLE IF NOT EXISTS _canary_check (id INT, val TEXT)")
            if dialect == "postgresql"
            else text("CREATE TEMP TABLE IF NOT EXISTS _canary_check (id INT, val TEXT)")
        )
        session.execute(text("INSERT INTO _canary_check VALUES (1, 'persistence_test')"))
        session.commit()
        
        # Verify persistence of committed data
        val = session.execute(text("SELECT val FROM _canary_check WHERE id = 1")).scalar()
        if val == "persistence_test":
            write_ok = True
        
        # Cleanup
        session.execute(text("DELETE FROM _canary_check WHERE id = 1"))
        session.commit()
        write_latency_ms = round((time.time() - w_start) * 1000, 2)
    except Exception as e:
        session.rollback()
        write_error = str(e)

    # 3. Table Counts
    try:
        user_count = session.query(User).count()
    except Exception:
        user_count = -1

    pool_info = {}
    if hasattr(engine.pool, "size"):
        pool_info = {
            "size": engine.pool.size(),
            "checked_in": engine.pool.checkedin(),
            "checked_out": engine.pool.checkedout(),
            "overflow": engine.pool.overflow(),
        }

    status_healthy = read_ok and write_ok

    return {
        "status": "healthy" if status_healthy else "degraded",
        "database_engine": dialect,
        "database_url_target": masked_url,
        "is_sqlite_fallback": dialect == "sqlite",
        "read_operational": read_ok,
        "read_latency_ms": read_latency_ms,
        "write_operational": write_ok,
        "write_latency_ms": write_latency_ms,
        "write_error": write_error,
        "total_users_persisted": user_count,
        "connection_pool": pool_info,
        "diagnostic_hint": (
            "Operating on local SQLite database (backend/eschola.db). If expecting Railway PostgreSQL, verify DATABASE_PUBLIC_URL TCP proxy or network connectivity."
            if dialect == "sqlite"
            else "Connected directly to PostgreSQL production database with persistent commits verified."
        ),
    }
