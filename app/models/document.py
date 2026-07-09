from __future__ import annotations


class Document:
    def __init__(self, id: int, session_id: str | None, original_name: str | None,
                 mime_type: str | None, document_type: str, status: str,
                 summary_arabic: str, raw_text: str | None, ...
                 created_at: str) -> None:
        self.id = id
        self.session_id = session_id
        self.original_name = original_name
        self.mime_type = mime_type
        self.document_type = document_type
        self.status = status
        self.summary_arabic = summary_arabic
        self.raw_text = raw_text
        ...
        self.created_at = created_at

    @classmethod
    def from_row(cls, row) -> Document:
        return cls(
            id=row["id"],
            session_id=row.get("session_id"),
            original_name=row.get("original_name"),
            mime_type=row.get("mime_type"),
            document_type=row["document_type"],
            status=row.get("status", "open"),
            summary_arabic=row["summary_arabic"],
            raw_text=row.get("raw_text"),
            ...
            created_at=row["created_at"],
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "session_id": self.session_id,
            "original_name": self.original_name,
            "mime_type": self.mime_type,
            "document_type": self.document_type,
            "status": self.status,
            "summary_arabic": self.summary_arabic,
            "raw_text": self.raw_text,
            ...
            "created_at": self.created_at,
        }
