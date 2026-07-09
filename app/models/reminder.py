from __future__ import annotations


class Reminder:
    def __init__(self, id: int, user_id: int, document_id: int | None,
                 title: str, due_date: str, ...
                 is_completed: bool, created_at: str) -> None:
        self.id = id
        self.user_id = user_id
        self.document_id = document_id
        self.title = title
        self.due_date = due_date
        ...
        self.is_completed = is_completed
        self.created_at = created_at

    @classmethod
    def from_row(cls, row) -> Reminder:
        return cls(
            id=row["id"],
            user_id=row["user_id"],
            document_id=row.get("document_id"),
            title=row["title"],
            due_date=row["due_date"],
            ...
            is_completed=bool(row.get("is_completed", 0)),
            created_at=row["created_at"],
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "document_id": self.document_id,
            "title": self.title,
            "due_date": self.due_date,
            ...
            "is_completed": self.is_completed,
            "created_at": self.created_at,
        }
