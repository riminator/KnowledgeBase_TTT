"""
ttt.py — Time Task Tracker query layer for the RAG chat pipeline.

Detects time-tracking intent in the user's question and fetches relevant
rows from the TTT ``time_entries`` table, returning them as a formatted
context block that can be merged into the LLM prompt alongside vector-DB
context.

Intent categories detected:
  - hours / time logged       → aggregate totals by project / date range
  - billable                  → billable flag filter
  - project lookup            → filter by project_code
  - task / entry list         → recent entries for a project or date range
  - general time query        → last N entries
"""
from __future__ import annotations

import logging
import os
import re
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

log = logging.getLogger(__name__)

# ── intent patterns ────────────────────────────────────────────────────────────

_TTT_PATTERNS = re.compile(
    r"\b("
    r"hour[s]?|time log(?:ged)?|time entry|time entries|time tracker"
    r"|how long|duration|minutes? logged"
    r"|billable|non.billable"
    r"|project code|task type"
    r"|time.?sheet|timesheet"
    r"|logged (today|this week|this month|last week|last month|yesterday)"
    r"|what did I (work on|do|log)"
    r"|entries? for|tasks? for"
    r")\b",
    re.IGNORECASE,
)


def is_ttt_query(question: str) -> bool:
    """Return True if the question is likely about TTT time entries."""
    return bool(_TTT_PATTERNS.search(question))


# ── date helpers ───────────────────────────────────────────────────────────────

def _date_range_from_question(question: str) -> tuple[date | None, date | None]:
    """
    Extract a (start, end) date range from natural language.
    Returns (None, None) if no temporal phrase is found (caller will use last 90 days).
    """
    today = date.today()
    q = question.lower()

    if "today" in q:
        return today, today
    if "yesterday" in q:
        d = today - timedelta(days=1)
        return d, d
    if "this week" in q:
        start = today - timedelta(days=today.weekday())
        return start, today
    if "last week" in q:
        start = today - timedelta(days=today.weekday() + 7)
        end   = start + timedelta(days=6)
        return start, end
    if "this month" in q:
        return today.replace(day=1), today
    if "last month" in q:
        first_this = today.replace(day=1)
        last_prev  = first_this - timedelta(days=1)
        return last_prev.replace(day=1), last_prev
    if "this year" in q:
        return today.replace(month=1, day=1), today

    return None, None


def _extract_project(question: str) -> str | None:
    """
    Pull an explicit project name out of the question.
    Looks for patterns like 'for Honda', 'on Honda', 'project Honda'.
    """
    m = re.search(
        r"\b(?:for|on|project(?:\s+code)?)\s+([A-Za-z0-9_\-]+)",
        question,
        re.IGNORECASE,
    )
    return m.group(1).strip() if m else None


# ── query builder + runner ─────────────────────────────────────────────────────

def _get_conn():
    import psycopg2
    url = os.environ.get("TTT_DATABASE_URL", "")
    if not url:
        raise RuntimeError("TTT_DATABASE_URL is not set.")
    ssl = "sslmode=require" in url or os.environ.get("TTT_PGSSL", "true").lower() == "true"
    kwargs: dict[str, Any] = {"dsn": url}
    if ssl:
        kwargs["sslmode"] = "require"
    return psycopg2.connect(**kwargs)


def query_ttt(question: str, limit: int = 20) -> str:
    """
    Run an appropriate SQL query against time_entries based on the question
    and return a formatted string suitable for use as LLM context.

    Returns an empty string if TTT_DATABASE_URL is not configured.
    """
    import psycopg2.extras

    ttt_url = os.environ.get("TTT_DATABASE_URL", "")
    if not ttt_url:
        return ""

    start, end = _date_range_from_question(question)
    project    = _extract_project(question)
    q_lower    = question.lower()

    # Default range: ±365 days from today when no temporal phrase found.
    # Wide window so queries work regardless of whether entries are dated in the
    # past or future (TTT entries may be pushed with server-local dates).
    if start is None:
        start = date.today() - timedelta(days=365)
        end   = date.today() + timedelta(days=365)

    params: dict[str, Any] = {"start": start, "end": end, "limit": limit}

    # ── choose query shape ────────────────────────────────────────────────────
    if re.search(r"\b(total|sum|how many hours?|how much time|aggregate)\b", q_lower):
        # Aggregated totals by project
        sql = """
            SELECT
                project_code,
                task_type,
                SUM(duration_minutes) AS total_minutes,
                COUNT(*)              AS entries,
                MIN(entry_date)       AS from_date,
                MAX(entry_date)       AS to_date,
                BOOL_OR(billable)     AS any_billable
            FROM time_entries
            WHERE entry_date BETWEEN %(start)s AND %(end)s
            {project_filter}
            GROUP BY project_code, task_type
            ORDER BY total_minutes DESC
            LIMIT %(limit)s
        """
    elif re.search(r"\bbillable\b", q_lower):
        sql = """
            SELECT id, project_code, task_type, entry_date,
                   duration_minutes, billable, status, description
            FROM time_entries
            WHERE entry_date BETWEEN %(start)s AND %(end)s
              AND billable = TRUE
            {project_filter}
            ORDER BY entry_date DESC
            LIMIT %(limit)s
        """
    else:
        # Default: recent entries with description
        sql = """
            SELECT id, project_code, task_type, entry_date,
                   duration_minutes, billable, status,
                   meeting_title, description
            FROM time_entries
            WHERE entry_date BETWEEN %(start)s AND %(end)s
            {project_filter}
            ORDER BY entry_date DESC
            LIMIT %(limit)s
        """

    # Inject optional project filter
    if project:
        project_clause = "AND project_code ILIKE %(project)s"
        params["project"] = f"%{project}%"
    else:
        project_clause = ""

    sql = sql.format(project_filter=project_clause)

    try:
        conn = _get_conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
        finally:
            conn.close()
    except Exception as exc:
        log.warning("TTT query failed: %s", exc)
        return ""

    if not rows:
        return f"[Time Task Tracker] No entries found for the queried period ({start} – {end}).\n"

    # ── format rows as readable context ──────────────────────────────────────
    lines = [f"[Time Task Tracker — {len(rows)} result(s), {start} to {end}]"]
    for row in rows:
        row = dict(row)
        # Convert Decimal to float for display
        mins = float(row.get("total_minutes") or row.get("duration_minutes") or 0)
        hours = mins / 60

        if "total_minutes" in row:
            # Aggregated row
            lines.append(
                f"  Project: {row['project_code']} | Type: {row['task_type']} | "
                f"Total: {mins:.0f} min ({hours:.1f} h) | Entries: {row['entries']} | "
                f"Billable: {row.get('any_billable', False)} | "
                f"Period: {row['from_date']} – {row['to_date']}"
            )
        else:
            # Individual entry
            desc = (row.get("description") or "")[:300].replace("\n", " ")
            lines.append(
                f"  [{row['entry_date']}] {row['project_code']} / {row['task_type']} | "
                f"{mins:.0f} min | Billable: {row.get('billable', False)} | "
                f"Status: {row.get('status')} | {row.get('meeting_title') or ''}\n"
                f"    Summary: {desc}"
            )

    return "\n".join(lines) + "\n"
