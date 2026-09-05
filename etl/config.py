"""Configuracion central del pipeline: rutas, fuentes, manifiesto y entorno.

Todas las rutas se derivan de la raiz del repo, asi el ETL corre igual en
cualquier maquina. Los parametros de pais se leen de .env para que F4
(comparativo Peru vs mundo) solo cambie variables, no codigo.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # dotenv es dependencia, pero no rompemos si falta
    pass

# --- Rutas ---------------------------------------------------------------
ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
RAW = DATA / "raw"
CACHE = DATA / "cache"
EXPORTS = DATA / "exports"
DOCS = ROOT / "docs"
DUCKDB_PATH = DATA / "atlas.duckdb"
MANIFEST_PATH = RAW / "manifest.json"

for _d in (DATA, RAW, CACHE, EXPORTS):
    _d.mkdir(parents=True, exist_ok=True)

# --- Parametros de pais (parametrizables para F4) ------------------------
COUNTRY_L3 = os.getenv("ATLAS_COUNTRY_L3", "PER")  # WGSRPD nivel 3
GBIF_COUNTRY = os.getenv("ATLAS_GBIF_COUNTRY", "PE")  # ISO2

# --- Reino (parametrizable; multi-reino) ---------------------------------
# Plantae = backbone WCVP (Kew) + GBIF taxonKey=6.
# Fungi   = backbone GBIF (componente Fungi = Index Fungorum, Kew) + taxonKey=5.
# Mismo esquema estrella y mismos marts; cambia la fuente, no el codigo.
KINGDOM = os.getenv("ATLAS_KINGDOM", "Plantae")

# Kingdom usageKey del backbone GBIF (Fungi=5, Plantae=6).
KINGDOM_GBIF_TAXONKEY = {"Plantae": 6, "Fungi": 5}

# --- Credenciales (opcionales segun fase) --------------------------------
GBIF_USER = os.getenv("GBIF_USER") or None
GBIF_PWD = os.getenv("GBIF_PWD") or None
GBIF_EMAIL = os.getenv("GBIF_EMAIL") or None
PLANTNET_API_KEY = os.getenv("PLANTNET_API_KEY") or None


@dataclass(frozen=True)
class Source:
    """Una fuente de datos con su URL de acceso y licencia."""

    key: str
    name: str
    access: str          # URL o endpoint principal
    license: str
    level: str           # granularidad (especie/genero/registro/nombre)
    needs_auth: bool = False


SOURCES: dict[str, Source] = {
    "wcvp": Source(
        key="wcvp",
        name="World Checklist of Vascular Plants",
        access="http://sftp.kew.org/pub/data-repositories/WCVP/wcvp.zip",
        license="CC BY 4.0",
        level="especie",
    ),
    "tol": Source(
        key="tol",
        name="Kew Tree of Life / PAFTOL",
        access="https://treeoflife.kew.org/api/tree",
        license="CC BY 4.0",
        level="genero",
    ),
    "gbif": Source(
        key="gbif",
        name="GBIF occurrences (country=PE)",
        access="pygbif.occurrences.download / .search",
        license="ver dataset (mayormente CC BY / CC0)",
        level="registro",
        needs_auth=True,
    ),
    "ipni": Source(
        key="ipni",
        name="International Plant Names Index",
        access="pykew.ipni",
        license="CC BY 4.0",
        level="nombre",
    ),
    "indexfungorum": Source(
        key="indexfungorum",
        name="Index Fungorum (via GBIF Backbone, kingdom Fungi)",
        access="https://api.gbif.org/v1/species/ (GBIF Backbone; componente Fungi = Index Fungorum, Kew)",
        license="CC BY 4.0",
        level="especie",
    ),
    "gbif_fungi": Source(
        key="gbif_fungi",
        name="GBIF occurrences Fungi (country=PE)",
        access="pygbif.occurrences.download / .search (taxonKey=5)",
        license="ver dataset (mayormente CC BY / CC0)",
        level="registro",
        needs_auth=True,
    ),
}


@dataclass
class Manifest:
    """Registro sellado de descargas: DOIs, fechas y hashes para reproducir."""

    entries: dict = field(default_factory=dict)

    @classmethod
    def load(cls) -> "Manifest":
        if MANIFEST_PATH.exists():
            return cls(json.loads(MANIFEST_PATH.read_text(encoding="utf-8")))
        return cls()

    def record(self, source_key: str, **meta) -> None:
        meta.setdefault("retrieved_at", datetime.now(timezone.utc).isoformat())
        self.entries[source_key] = meta
        self.save()

    def save(self) -> None:
        MANIFEST_PATH.write_text(
            json.dumps(self.entries, indent=2, ensure_ascii=False), encoding="utf-8"
        )

    def get(self, source_key: str) -> dict | None:
        return self.entries.get(source_key)
