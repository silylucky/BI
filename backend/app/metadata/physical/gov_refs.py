from __future__ import annotations

"""In-memory GOV catalog → physical table reference registry (META-005 companion)."""

_catalog_refs: dict[str, set[str]] = {}
_entry_to_fqns: dict[str, set[str]] = {}


def register_catalog_ref(table_fqn: str, catalog_entry_id: str) -> None:
    fqn = table_fqn.lower()
    entry_id = str(catalog_entry_id)
    _catalog_refs.setdefault(fqn, set()).add(entry_id)
    _entry_to_fqns.setdefault(entry_id, set()).add(fqn)


def catalog_ref_count(table_fqn: str) -> int:
    return len(_catalog_refs.get(table_fqn.lower(), set()))


def list_catalog_refs(table_fqn: str) -> list[str]:
    return sorted(_catalog_refs.get(table_fqn.lower(), set()))


def release_catalog_refs_for_entry(catalog_entry_id: str) -> list[str]:
    entry_id = str(catalog_entry_id)
    fqns = list(_entry_to_fqns.pop(entry_id, set()))
    for fqn in fqns:
        refs = _catalog_refs.get(fqn)
        if refs:
            refs.discard(entry_id)
            if not refs:
                _catalog_refs.pop(fqn, None)
    return fqns


def lineage_stub(table_fqn: str) -> dict:
    fqn = table_fqn.lower()
    return {
        "tableFqn": fqn,
        "catalogEntryIds": list_catalog_refs(fqn),
        "upstream": [],
        "downstream": [],
        "stub": True,
    }


def clear_all() -> None:
    _catalog_refs.clear()
    _entry_to_fqns.clear()
