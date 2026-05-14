MAX_ACTIVITY_TEXT_CACHE_SIZE = 1000
_ACTIVITY_TEXT_CACHE: dict[str, str] = {}


def cache_activity_text(activity_id: str, text: str) -> None:
    key = (activity_id or "").strip()
    value = (text or "").strip()
    if not key or not value:
        return
    _ACTIVITY_TEXT_CACHE[key] = value
    if len(_ACTIVITY_TEXT_CACHE) > MAX_ACTIVITY_TEXT_CACHE_SIZE:
        oldest_key = next(iter(_ACTIVITY_TEXT_CACHE))
        _ACTIVITY_TEXT_CACHE.pop(oldest_key, None)


def get_cached_activity_text(activity_id: str) -> str:
    return _ACTIVITY_TEXT_CACHE.get((activity_id or "").strip(), "")
