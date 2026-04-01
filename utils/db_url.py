from urllib.parse import quote_plus, unquote_plus


def encode_database_url_password(database_url: str) -> str:
    if "://" not in database_url or "@" not in database_url:
        return database_url

    scheme, remainder = database_url.split("://", 1)
    userinfo, host_and_tail = remainder.rsplit("@", 1)
    if ":" not in userinfo:
        return database_url

    username, password = userinfo.split(":", 1)
    encoded_password = quote_plus(unquote_plus(password))
    return f"{scheme}://{username}:{encoded_password}@{host_and_tail}"
