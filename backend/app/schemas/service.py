from __future__ import annotations

from pydantic import BaseModel


class ServiceCategory(BaseModel):
    id: int
    name_ar: str
    icon_emoji: str
    icon_url: str | None = None


class NearbyOffice(BaseModel):
    id: int
    name_ar: str
    address_ar: str
    coords: dict[str, float]
    hours: str
    phone: str
    distance_km: float
