import logging
import sys


def configure_logging(level: str) -> None:
    # On Windows, redirected stdio defaults to a legacy code page (cp1252) that can't encode
    # Romanian/Russian text, so log lines came out as "ă". Logs are always UTF-8.
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            reconfigure(encoding="utf-8", errors="backslashreplace")
    logging.basicConfig(
        level=level.upper(),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
