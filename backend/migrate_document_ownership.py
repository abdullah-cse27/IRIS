"""One-time, repeat-safe SQLite migration for IRIS document ownership.

Run from the backend directory:
    python migrate_document_ownership.py

Back up the SQLite database before running this script.
"""
from sqlalchemy import inspect, text

from app.database import engine


def main() -> None:
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    if "documents" not in table_names:
        raise RuntimeError(
            "The 'documents' table does not exist. Start the backend once or "
            "verify that this script uses the same database configuration."
        )

    if "users" not in table_names:
        raise RuntimeError(
            "The 'users' table does not exist. Verify the database before migrating."
        )

    columns = {column["name"] for column in inspector.get_columns("documents")}

    if "user_id" not in columns:
        # SQLite supports adding a nullable column with a REFERENCES clause.
        with engine.begin() as connection:
            connection.execute(text(
                "ALTER TABLE documents ADD COLUMN user_id INTEGER "
                "REFERENCES users(id) ON DELETE CASCADE"
            ))
        print("Added documents.user_id column.")
    else:
        print("documents.user_id already exists; no column change needed.")

    with engine.begin() as connection:
        connection.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_documents_user_id "
            "ON documents (user_id)"
        ))
        unassigned = connection.execute(text(
            "SELECT COUNT(*) FROM documents WHERE user_id IS NULL"
        )).scalar_one()
        total = connection.execute(text(
            "SELECT COUNT(*) FROM documents"
        )).scalar_one()

    print("Ensured index ix_documents_user_id exists.")
    print(f"Documents in database: {total}")
    print(f"Documents without a verified owner: {unassigned}")
    if unassigned:
        print(
            "IMPORTANT: These legacy documents remain unassigned and will not "
            "appear in any user's document list. Assign ownership only after "
            "verifying the real owner; this script does not guess owners."
        )
    print("Migration finished. It is safe to rerun this script if needed.")


if __name__ == "__main__":
    main()
