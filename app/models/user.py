from __future__ import annotations


class User:
    def __init__(self, id: int, username: str, email: str, ...
                 created_at: str) -> None:
        self.id = id
        self.username = username
        self.email = email
        ...
        self.created_at = created_at

    @classmethod
    def from_row(cls, row) -> User:
        return cls(
            id=row["id"],
            username=row["username"],
            email=row["email"],
            ...
            created_at=row["created_at"],
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            ...
            "created_at": self.created_at,
        }
