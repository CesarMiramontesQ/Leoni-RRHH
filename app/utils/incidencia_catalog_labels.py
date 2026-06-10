"""Resolución de área/subárea guardadas como ID numérico hacia descripción de catálogo."""

from __future__ import annotations

from dataclasses import dataclass


def looks_like_catalog_id(value: str | None) -> bool:
    if value is None:
        return False
    t = str(value).strip()
    return bool(t) and t.isdigit()


@dataclass(frozen=True)
class IncidenciaCatalogLabelMaps:
    area_by_id: dict[int, str]
    subarea_by_id: dict[int, str]

    def resolve_area(self, raw: str | None) -> str | None:
        if raw is None:
            return None
        t = str(raw).strip()
        if not t:
            return None
        if looks_like_catalog_id(t):
            return self.area_by_id.get(int(t), t)
        return t

    def resolve_subarea(self, raw: str | None) -> str | None:
        if raw is None:
            return None
        t = str(raw).strip()
        if not t:
            return None
        if looks_like_catalog_id(t):
            return self.subarea_by_id.get(int(t), t)
        return t

    def aliases_for_area_filter(self, label: str | None) -> list[str] | None:
        if not label or not str(label).strip():
            return None
        t = str(label).strip()
        aliases = {t}
        if looks_like_catalog_id(t):
            resolved = self.area_by_id.get(int(t))
            if resolved:
                aliases.add(resolved)
        else:
            for area_id, name in self.area_by_id.items():
                if name == t:
                    aliases.add(str(area_id))
        return sorted(aliases)

    def aliases_for_subarea_filter(self, label: str | None) -> list[str] | None:
        if not label or not str(label).strip():
            return None
        t = str(label).strip()
        aliases = {t}
        if looks_like_catalog_id(t):
            resolved = self.subarea_by_id.get(int(t))
            if resolved:
                aliases.add(resolved)
        else:
            for subarea_id, name in self.subarea_by_id.items():
                if name == t:
                    aliases.add(str(subarea_id))
        return sorted(aliases)

    def distinct_resolved_areas(self, raw: list[str]) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for item in raw:
            resolved = self.resolve_area(item) or item
            if resolved not in seen:
                seen.add(resolved)
                out.append(resolved)
        return sorted(out, key=lambda s: (s == "(sin área)", s.lower()))

    def distinct_resolved_subareas(self, raw: list[str]) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for item in raw:
            resolved = self.resolve_subarea(item) or item
            if resolved not in seen:
                seen.add(resolved)
                out.append(resolved)
        return sorted(out, key=lambda s: (s == "(sin subárea)", s.lower()))

    def merge_area_totals(self, raw: list[tuple[str, int]]) -> list[tuple[str, int]]:
        merged: dict[str, int] = {}
        for label, cnt in raw:
            key = self.resolve_area(label) or label
            merged[key] = merged.get(key, 0) + cnt
        return sorted(merged.items(), key=lambda x: (-x[1], x[0].lower()))

    def resolve_area_id(self, label: str | None) -> int | None:
        if not label or not str(label).strip():
            return None
        t = str(label).strip()
        if looks_like_catalog_id(t):
            area_id = int(t)
            return area_id if area_id in self.area_by_id else None
        for area_id, name in self.area_by_id.items():
            if name == t:
                return area_id
        return None

    def merge_subarea_totals(
        self, raw: list[tuple[str, str, int]]
    ) -> list[tuple[str, str, int]]:
        by_sub: dict[str, dict[str, int]] = {}
        for sub, area, cnt in raw:
            sub_key = self.resolve_subarea(sub) or sub
            area_key = self.resolve_area(area) or area
            m = by_sub.setdefault(sub_key, {})
            m[area_key] = m.get(area_key, 0) + cnt
        out: list[tuple[str, str, int]] = []
        for sub_key, areas_map in by_sub.items():
            total = sum(areas_map.values())
            best_area = max(areas_map, key=lambda a: areas_map[a])
            out.append((sub_key, best_area, total))
        return sorted(out, key=lambda x: (-x[2], x[0].lower()))
