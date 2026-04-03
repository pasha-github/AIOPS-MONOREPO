from utils.db_url import encode_database_url_password


def test_encode_database_url_password_encodes_special_characters():
    raw_url = "postgresql://dbuser:kx@jj5/g@pghost10/appdb"

    assert encode_database_url_password(raw_url) == (
        "postgresql://dbuser:kx%40jj5%2Fg@pghost10/appdb"
    )


def test_encode_database_url_password_preserves_sqlite_url():
    sqlite_url = "sqlite:///agent_management.db"

    assert encode_database_url_password(sqlite_url) == sqlite_url
