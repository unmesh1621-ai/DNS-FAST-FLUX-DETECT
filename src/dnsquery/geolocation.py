from geoip2.database import Reader
from pathlib import Path
from tinylogging import new_event

CONFIG_PATH = Path(__file__).parent.parent / "config"

_ASN_DB = None
_ASN_DB_LOAD_FAILED = False
_COUNTRY_DB = None
_COUNTRY_DB_LOAD_FAILED = False


def _get_asn_db() -> Reader | None:
    global _ASN_DB, _ASN_DB_LOAD_FAILED
    if _ASN_DB is None and not _ASN_DB_LOAD_FAILED:
        try:
            _ASN_DB = Reader(CONFIG_PATH / "GeoLite2-ASN.mmdb")
        except Exception:
            _ASN_DB_LOAD_FAILED = True
            new_event("GeoLite2-ASN.mmdb not found - ASN lookups disabled\n", "red")
    return _ASN_DB


def _get_country_db() -> Reader | None:
    global _COUNTRY_DB, _COUNTRY_DB_LOAD_FAILED
    if _COUNTRY_DB is None and not _COUNTRY_DB_LOAD_FAILED:
        try:
            _COUNTRY_DB = Reader(CONFIG_PATH / "GeoLite2-Country.mmdb")
        except Exception:
            _COUNTRY_DB_LOAD_FAILED = True
            new_event("GeoLite2-Country.mmdb not found - country lookups disabled\n", "red")
    return _COUNTRY_DB


def get_asn(ip: str) -> int | None:
    asn_db = _get_asn_db()
    if asn_db is None:
        return None

    new_event(f"Extracting ASN for {ip}", "blue")
    try:
        response = asn_db.asn(ip)
        new_event("Done\n", "green")
        return response.autonomous_system_number
    except Exception:
        new_event("Error Extracting ASN\n", "red")
        return None

def get_country(ip: str) -> str | None:
    country_db = _get_country_db()
    if country_db is None:
        return None

    new_event(f"Extracting Country for {ip}", "blue")
    try:
        response = country_db.country(ip)
        new_event("Done\n", "green")
        return response.country.iso_code
    except Exception:
        new_event("Error Extracting Country\n", "red")
        return None


