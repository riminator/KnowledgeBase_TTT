"""
Ingestion pipeline: walk a file or directory, extract text, embed with Ollama,
and upsert into pgvector.
"""
from __future__ import annotations

import pathlib
from typing import Generator

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn
from sqlalchemy import select

from kb.db import Document, get_session, init_db
from kb.embedder import embed
from kb.extractors import extract

console = Console()

SUPPORTED_SUFFIXES: set[str] = {
    # documents
    ".pdf", ".docx", ".doc", ".txt", ".md", ".rst", ".csv",
    ".json", ".yaml", ".yml", ".xml", ".html", ".htm",
    ".log", ".toml", ".ini", ".cfg",
    # code
    ".py", ".js", ".ts", ".go", ".java", ".c", ".cpp", ".h", ".rb", ".sh",
    # images
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".tif", ".webp",
}


def _iter_files(root: pathlib.Path) -> Generator[pathlib.Path, None, None]:
    """Yield all files under *root* that match supported suffixes."""
    if root.is_file():
        yield root
        return
    for path in sorted(root.rglob("*")):
        if path.is_file() and path.suffix.lower() in SUPPORTED_SUFFIXES:
            yield path


def _already_indexed(session, source: str, *, user_id: str | None = None) -> bool:
    stmt = select(Document.id).where(Document.source == source)
    if user_id:
        stmt = stmt.where(Document.user_id == user_id)
    return session.execute(stmt.limit(1)).first() is not None


def ingest(
    path: str | pathlib.Path,
    *,
    force: bool = False,
    source_name: str | None = None,
    user_id: str | None = None,
    extra_meta: dict | None = None,
) -> None:
    """
    Ingest a single file or every supported file inside a directory.

    Args:
        path:        File or directory path.
        force:       Re-index files that are already in the database.
        source_name: Override the source key stored in the DB (e.g. the
                     original upload filename instead of a temp path).
                     Only used when *path* resolves to a single file.
        user_id:     Supabase user UUID to scope the document to. When set,
                     dedup check is also scoped to this user.
        extra_meta:  Additional metadata to merge into doc_metadata (e.g.
                     project_code, doc_type supplied by the uploader).
    """
    init_db()
    root = pathlib.Path(path).expanduser().resolve()

    files = list(_iter_files(root))
    if not files:
        console.print(f"[yellow]No supported files found under {root}[/yellow]")
        return

    console.print(f"[bold]Found {len(files)} file(s) to process.[/bold]")

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TaskProgressColumn(),
        console=console,
        transient=False,
    ) as progress:
        task = progress.add_task("Ingesting…", total=len(files))

        for file_path in files:
            progress.update(task, description=f"[cyan]{file_path.name}[/cyan]")
            session = get_session()
            try:
                # Use the caller-supplied name when ingesting a single uploaded
                # file so the DB key is the original filename, not a temp path.
                source_key = source_name if (source_name and len(files) == 1) else str(file_path)

                if not force and _already_indexed(session, source_key, user_id=user_id):
                    console.print(f"  [dim]skip (already indexed):[/dim] {file_path.name}")
                    progress.advance(task)
                    continue

                file_type, chunks, doc_meta = extract(file_path)

                if not chunks:
                    console.print(f"  [yellow]no text extracted:[/yellow] {file_path.name}")
                    progress.advance(task)
                    continue

                # Merge caller-supplied metadata (project_code, doc_type, etc.)
                if extra_meta:
                    doc_meta = {**doc_meta, **extra_meta}

                # Allow caller to override the stored file_type label
                stored_type = extra_meta.get("doc_type") if extra_meta else None
                stored_type = stored_type or file_type

                # Remove old records when force re-indexing
                if force:
                    q = session.query(Document).filter(Document.source == source_key)
                    if user_id:
                        q = q.filter(Document.user_id == user_id)
                    q.delete()
                    session.commit()

                for idx, chunk in enumerate(chunks):
                    vector = embed(chunk)
                    doc = Document(
                        user_id=user_id,
                        source=source_key,
                        file_type=stored_type,
                        chunk_index=idx,
                        content=chunk,
                        embedding=vector,
                        doc_metadata=doc_meta if doc_meta else None,
                    )
                    session.add(doc)

                session.commit()
                console.print(
                    f"  [green]✓[/green] {file_path.name} "
                    f"[dim]({file_type}, {len(chunks)} chunk(s))[/dim]"
                )
            except Exception as exc:
                session.rollback()
                console.print(f"  [red]✗ {file_path.name}:[/red] {exc}")
            finally:
                session.close()
                progress.advance(task)

    console.print("[bold green]Done.[/bold green]")
