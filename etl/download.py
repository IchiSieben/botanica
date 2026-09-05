"""Paso 1: descarga sellada por fecha/DOI. Idempotente.

Reglas (principios 1 y 5 del spec):
- Bajar TODO una sola vez a data/raw/. Si ya existe y el hash coincide, no rebaja.
- Registrar cada descarga en el manifiesto (URL, fecha UTC, sha256, DOI cuando aplique).
- Las APIs en vivo (POWO, Pl@ntNet) NO se bajan aca; son on-demand en F3/F5.

Modo --sample: trae solo lo liviano (Tree of Life Newick + una muestra de
ocurrencias GBIF via search) para validar el pipeline sin GBs en disco.
WCVP completo y GBIF download (DOI) requieren --full.
"""

from __future__ import annotations

import hashlib
import json
import unicodedata
import zipfile
from pathlib import Path

import requests

from . import config as C

_TIMEOUT = 60
_CHUNK = 1 << 16


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(_CHUNK), b""):
            h.update(chunk)
    return h.hexdigest()


def _stream_to(url: str, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    with requests.get(url, stream=True, timeout=_TIMEOUT) as r:
        r.raise_for_status()
        with tmp.open("wb") as fh:
            for chunk in r.iter_content(_CHUNK):
                fh.write(chunk)
    tmp.replace(dest)
    return dest


# --- WCVP ----------------------------------------------------------------
def download_wcvp(force: bool = False) -> Path:
    """Baja y descomprime el zip de WCVP (backbone taxonomico + distribucion)."""
    src = C.SOURCES["wcvp"]
    out_dir = C.RAW / "wcvp"
    zip_path = C.RAW / "wcvp.zip"
    if out_dir.exists() and any(out_dir.iterdir()) and not force:
        print(f"[wcvp] ya presente en {out_dir} (usa --force para rebajar)")
        return out_dir

    print(f"[wcvp] descargando {src.access} ...")
    _stream_to(src.access, zip_path)
    digest = _sha256(zip_path)
    out_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(out_dir)
    C.Manifest.load().record(
        "wcvp", url=src.access, sha256=digest, license=src.license,
        doi="10.15468/6h8ucr", note="snapshot sellado por fecha de Kew",
    )
    print(f"[wcvp] OK -> {out_dir}")
    return out_dir


# --- Tree of Life --------------------------------------------------------
def download_tol(force: bool = False) -> Path:
    """Baja el arbol Newick (PAFTOL / Tree of Life), nivel genero."""
    src = C.SOURCES["tol"]
    out = C.RAW / "treeoflife.tree"
    if out.exists() and not force:
        print(f"[tol] ya presente en {out}")
        return out
    print(f"[tol] descargando {src.access} ...")
    r = requests.get(src.access, timeout=_TIMEOUT)
    r.raise_for_status()
    out.write_text(r.text, encoding="utf-8")
    C.Manifest.load().record(
        "tol", url=src.access, sha256=_sha256(out), license=src.license,
        note="Newick; etiquetas id_bool_Orden_Familia_Genero_especie",
    )
    print(f"[tol] OK -> {out} ({out.stat().st_size} bytes)")
    return out


# --- GeoJSON departamentos del Peru --------------------------------------
# DOS geometrias DESACOPLADAS a proposito (ver ADR 0003 / geo.py):
#   * SIMPLE  (juaneladio/peru-geojson)  -> SOLO render de la coropleta web.
#     Esta simplificado para el navegador; recorta ~200-400 m de costa (p.ej.
#     La Punta, Callao), por eso NO sirve para el join espacial del backend.
#   * DETALLADO (geoBoundaries gbOpen ADM1, CC BY 4.0) -> join espacial backend.
#     Alta resolucion: contiene por ST_Contains los puntos costeros que el
#     simplificado dejaba afuera. Es la geometria de verdad para asignar puntos.
_PERU_SIMPLE_URL = (
    "https://raw.githubusercontent.com/juaneladio/peru-geojson/master/"
    "peru_departamental_simple.geojson"
)
_GEOBOUNDARIES_API = "https://www.geoboundaries.org/api/current/gbOpen/PER/ADM1/"

# geoBoundaries usa shapeName (acentuado, en espanol) y separa Lima de su
# provincia metropolitana (26 unidades). Lo normalizamos a los 25 NOMBDEP
# oficiales: deaccent+upper + estos overrides + union de las dos "Lima".
_NOMBDEP_OVERRIDES = {
    "EL CALLAO": "CALLAO",
    "MUNICIPALIDAD METROPOLITANA DE LIMA": "LIMA",
}
# Los 25 NOMBDEP canonicos (mismos que el simplificado de juaneladio).
_NOMBDEP_CANON = {
    "AMAZONAS", "ANCASH", "APURIMAC", "AREQUIPA", "AYACUCHO", "CAJAMARCA",
    "CALLAO", "CUSCO", "HUANCAVELICA", "HUANUCO", "ICA", "JUNIN", "LA LIBERTAD",
    "LAMBAYEQUE", "LIMA", "LORETO", "MADRE DE DIOS", "MOQUEGUA", "PASCO",
    "PIURA", "PUNO", "SAN MARTIN", "TACNA", "TUMBES", "UCAYALI",
}


def _round_coords(coords, nd: int = 4):
    """Redondea recursivamente toda coordenada del arreglo anidado a nd decimales."""
    if isinstance(coords, (int, float)):
        return round(coords, nd)
    return [_round_coords(c, nd) for c in coords]


def _to_nombdep(shape_name: str) -> str:
    """shapeName de geoBoundaries -> NOMBDEP canonico (deaccent + upper + overrides)."""
    norm = unicodedata.normalize("NFKD", shape_name)
    ascii_up = "".join(c for c in norm if not unicodedata.combining(c)).upper().strip()
    return _NOMBDEP_OVERRIDES.get(ascii_up, ascii_up)


def download_peru_geojson_simple(force: bool = False) -> Path:
    """SIMPLE (juaneladio): coropleta del frontend. Coords a 4 decimales (~11 m)."""
    out = C.RAW / "peru_departamental_simple.geojson"
    if out.exists() and not force:
        print(f"[geo] simple ya presente en {out}")
        return out
    print(f"[geo] descargando SIMPLE (frontend) {_PERU_SIMPLE_URL} ...")
    r = requests.get(_PERU_SIMPLE_URL, timeout=_TIMEOUT)
    r.raise_for_status()
    data = r.json()
    for feat in data.get("features", []):
        feat["properties"] = {"NOMBDEP": feat["properties"].get("NOMBDEP")}
        feat["geometry"]["coordinates"] = _round_coords(feat["geometry"]["coordinates"], 4)
    out.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    n = len(data.get("features", []))
    C.Manifest.load().record(
        "peru_geojson_simple", url=_PERU_SIMPLE_URL, sha256=_sha256(out),
        license="ver repo juaneladio/peru-geojson", n_departamentos=n,
        uso="render coropleta frontend (NO join backend)",
        note="coords a 4 decimales; clave NOMBDEP",
    )
    print(f"[geo] simple OK -> {out} ({n} features, solo render)")
    return out


def download_peru_geojson_detallado(force: bool = False) -> Path:
    """DETALLADO (geoBoundaries gbOpen ADM1, CC BY 4.0): geometria del join backend.

    Normaliza shapeName -> 25 NOMBDEP canonicos, une las dos "Lima"
    (departamento + provincia metropolitana) en un solo poligono LIMA, y deja
    coords a 5 decimales (~1 m) para preservar la costa que el simplificado
    recorta. Es la geometria precisa: con ella Callao resuelve por contencion.
    """
    from shapely.geometry import mapping, shape
    from shapely.ops import unary_union

    out = C.RAW / "peru_departamental_detallado.geojson"
    if out.exists() and not force:
        print(f"[geo] detallado ya presente en {out}")
        return out

    print(f"[geo] resolviendo geoBoundaries {_GEOBOUNDARIES_API} ...")
    meta = requests.get(_GEOBOUNDARIES_API, timeout=_TIMEOUT).json()
    gj_url = meta["gjDownloadURL"]
    print(f"[geo] descargando DETALLADO (backend) {gj_url} ...")
    gj = requests.get(gj_url, timeout=_TIMEOUT).json()

    # Agrupar geometrias por NOMBDEP (union para las dos "Lima").
    by_dep: dict[str, list] = {}
    for feat in gj.get("features", []):
        dep = _to_nombdep(feat["properties"].get("shapeName", ""))
        by_dep.setdefault(dep, []).append(shape(feat["geometry"]))

    unknown = set(by_dep) - _NOMBDEP_CANON
    missing = _NOMBDEP_CANON - set(by_dep)
    if unknown or missing:
        raise RuntimeError(
            f"mapeo shapeName->NOMBDEP no cuadra: extra={sorted(unknown)} "
            f"falta={sorted(missing)}"
        )

    features = []
    for dep in sorted(by_dep):
        geom = by_dep[dep][0] if len(by_dep[dep]) == 1 else unary_union(by_dep[dep])
        gj_geom = mapping(geom)
        gj_geom["coordinates"] = _round_coords(gj_geom["coordinates"], 5)
        features.append({
            "type": "Feature",
            "properties": {"NOMBDEP": dep},
            "geometry": gj_geom,
        })
    fc = {"type": "FeatureCollection", "features": features}
    out.write_text(json.dumps(fc, ensure_ascii=False), encoding="utf-8")

    C.Manifest.load().record(
        "peru_geojson_detallado", url=gj_url, api=_GEOBOUNDARIES_API,
        sha256=_sha256(out), source="geoBoundaries gbOpen PER ADM1",
        license="CC BY 4.0", n_departamentos=len(features),
        uso="join espacial backend (ST_Contains/snap)",
        note="shapeName->NOMBDEP (deaccent+upper); union de las dos Lima; "
             "coords a 5 decimales; 26->25 unidades",
    )
    print(f"[geo] detallado OK -> {out} ({len(features)} departamentos, join backend)")
    return out


# --- GBIF ----------------------------------------------------------------
def download_gbif_sample(limit: int = 300) -> Path:
    """Muestra liviana de ocurrencias de Peru via occurrences.search (sin login).

    Sirve para validar limpieza/perfilamiento. NO es reproducible por DOI;
    para el dataset real usar download_gbif_full().
    """
    from pygbif import occurrences as occ

    out = C.RAW / "gbif" / "sample_occurrences.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    print(f"[gbif] muestra search country={C.GBIF_COUNTRY} limit={limit} ...")
    recs: list[dict] = []
    offset = 0
    page = min(300, limit)
    while len(recs) < limit:
        resp = occ.search(
            country=C.GBIF_COUNTRY, hasCoordinate=True, kingdomKey=6,  # Plantae
            limit=page, offset=offset,
        )
        results = resp.get("results", [])
        if not results:
            break
        recs.extend(results)
        offset += page
        if resp.get("endOfRecords"):
            break
    recs = recs[:limit]
    out.write_text(json.dumps(recs, ensure_ascii=False), encoding="utf-8")
    C.Manifest.load().record(
        "gbif_sample", endpoint="occurrences.search", country=C.GBIF_COUNTRY,
        n=len(recs), note="muestra NO reproducible; solo perfilamiento",
    )
    print(f"[gbif] muestra OK -> {out} ({len(recs)} registros)")
    return out


# Campos planos que necesita el pipeline (proyectamos el JSON anidado del search).
_GBIF_FIELDS = [
    "key", "scientificName", "species", "genus", "family", "order", "taxonRank",
    "taxonomicStatus", "taxonKey", "speciesKey", "acceptedTaxonKey", "acceptedScientificName",
    "decimalLatitude", "decimalLongitude", "coordinateUncertaintyInMeters",
    "elevation", "year", "basisOfRecord", "stateProvince", "countryCode",
]


def download_gbif_search_kingdom(kingdom: str, out_name: str, cap: int = 100_000) -> Path:
    """Trae TODAS las ocurrencias georreferenciadas de un reino en el pais via
    occurrences.search (paginado). Para reinos chicos (hongos: ~15k) esto es el
    set COMPLETO, no una muestra. Proyecta a campos planos para el loader.

    El search no da DOI; la version reproducible/sellada por DOI la dispara
    request_gbif_download_kingdom(). Mismo predicado en ambos.
    """
    from pygbif import occurrences as occ

    taxonkey = C.KINGDOM_GBIF_TAXONKEY[kingdom]
    out = C.RAW / "gbif" / out_name
    out.parent.mkdir(parents=True, exist_ok=True)

    total = occ.search(country=C.GBIF_COUNTRY, taxonKey=taxonkey,
                       hasCoordinate=True, hasGeospatialIssue=False, limit=0).get("count", 0)
    print(f"[gbif:{kingdom}] {total} ocurrencias georref en {C.GBIF_COUNTRY} (taxonKey={taxonkey})")
    if total > cap:
        print(f"[gbif:{kingdom}] supera {cap}; usar descarga por DOI (request_gbif_download_kingdom)")

    recs: list[dict] = []
    offset, page = 0, 300
    while offset < min(total, cap):
        resp = occ.search(
            country=C.GBIF_COUNTRY, taxonKey=taxonkey,
            hasCoordinate=True, hasGeospatialIssue=False, limit=page, offset=offset,
        )
        results = resp.get("results", [])
        if not results:
            break
        recs.extend({k: r.get(k) for k in _GBIF_FIELDS} for r in results)
        offset += page
        if resp.get("endOfRecords"):
            break

    out.write_text(json.dumps(recs, ensure_ascii=False), encoding="utf-8")
    C.Manifest.load().record(
        f"gbif_{kingdom.lower()}_search",
        endpoint="occurrences.search", country=C.GBIF_COUNTRY, taxon_key=taxonkey,
        kingdom=kingdom, n=len(recs), complete=(len(recs) >= total),
        predicate=f"country={C.GBIF_COUNTRY} AND taxonKey={taxonkey} AND "
                  "hasCoordinate=TRUE AND hasGeospatialIssue=FALSE",
        note="set completo via search (reino chico); DOI reproducible aparte",
    )
    print(f"[gbif:{kingdom}] OK -> {out.name} ({len(recs)} registros)")
    return out


def request_gbif_download_kingdom(kingdom: str) -> str | None:
    """Dispara la descarga reproducible (DOI) para un reino y la sella en el
    manifiesto. Async en GBIF; se recupera luego con download_gbif_get(key).
    Si faltan credenciales, registra el predicado y deja el DOI pendiente."""
    taxonkey = C.KINGDOM_GBIF_TAXONKEY[kingdom]
    predicate = (f"country = {C.GBIF_COUNTRY} AND taxonKey = {taxonkey} AND "
                 "hasCoordinate = TRUE AND hasGeospatialIssue = FALSE")
    if not (C.GBIF_USER and C.GBIF_PWD and C.GBIF_EMAIL):
        C.Manifest.load().record(
            f"gbif_{kingdom.lower()}", kingdom=kingdom, predicate=predicate,
            doi=None, status="pendiente (sin credenciales GBIF en .env)",
            note="set actual = search completo; correr con credenciales para DOI sellado",
        )
        print(f"[gbif:{kingdom}] sin credenciales; DOI pendiente (predicado sellado)")
        return None
    from pygbif import occurrences as occ
    try:
        pred = occ.download(
            [f"country = {C.GBIF_COUNTRY}", f"taxonKey = {taxonkey}",
             "hasCoordinate = TRUE", "hasGeospatialIssue = FALSE"],
            user=C.GBIF_USER, pwd=C.GBIF_PWD, email=C.GBIF_EMAIL,
        )
        key = pred[0] if isinstance(pred, (list, tuple)) else pred
        doi = f"10.15468/dl.{key}"
        C.Manifest.load().record(
            f"gbif_{kingdom.lower()}", kingdom=kingdom, endpoint="occurrences.download",
            download_key=key, doi=doi, predicate=predicate, status="solicitada (async)",
            note="recuperar con download_gbif_get(key) cuando GBIF la procese",
        )
        print(f"[gbif:{kingdom}] descarga solicitada. key={key} DOI={doi}")
        return key
    except Exception as e:  # noqa: BLE001 — no bloquear el pipeline por la descarga async
        C.Manifest.load().record(
            f"gbif_{kingdom.lower()}", kingdom=kingdom, predicate=predicate,
            doi=None, status=f"error al solicitar: {e}",
            note="set actual = search completo; reintentar descarga por DOI luego",
        )
        print(f"[gbif:{kingdom}] no se pudo solicitar la descarga ({e}); sigo con search")
        return None


def download_gbif_full() -> str:
    """Solicita la descarga reproducible (predicado country=PE) y devuelve DOI.

    Requiere credenciales GBIF en .env. La descarga se procesa async en el
    servidor de GBIF; aca se dispara y se registra el download key + DOI.
    """
    if not (C.GBIF_USER and C.GBIF_PWD and C.GBIF_EMAIL):
        raise RuntimeError(
            "Faltan GBIF_USER/GBIF_PWD/GBIF_EMAIL en .env. "
            "Necesarios para occurrences.download() reproducible."
        )
    from pygbif import occurrences as occ

    pred = occ.download(
        [
            f"country = {C.GBIF_COUNTRY}",
            "hasCoordinate = TRUE",
            "hasGeospatialIssue = FALSE",
            "taxonKey = 6",  # Plantae
        ],
        user=C.GBIF_USER, pwd=C.GBIF_PWD, email=C.GBIF_EMAIL,
    )
    download_key = pred[0] if isinstance(pred, (list, tuple)) else pred
    doi = f"10.15468/dl.{download_key}"
    C.Manifest.load().record(
        "gbif", endpoint="occurrences.download", download_key=download_key,
        doi=doi, predicate=f"country={C.GBIF_COUNTRY};Plantae;hasCoordinate",
        note="descarga async en GBIF; recuperar zip con occ.download_get(key)",
    )
    print(f"[gbif] solicitada. download_key={download_key} DOI={doi}")
    print("[gbif] cuando este lista: pygbif.occurrences.download_get(key)")
    return download_key


def download_gbif_get(
    download_key: str,
    doi: str,
    *,
    manifest_key: str = "gbif",
    kingdom: str = "Plantae",
    n_expected: int | None = None,
    citation: str | None = None,
    force: bool = False,
) -> Path:
    """Recupera el zip reproducible de una descarga GBIF ya procesada y extrae el TSV.

    Formato SIMPLE de GBIF: el zip contiene un unico `<key>.csv` que en realidad
    es TAB-separado. Lo dejamos en data/raw/gbif/ para que el loader lo tome por
    la misma ruta que cualquier .csv. Sella sha256 + DOI + n + filtro en el
    manifiesto (bajo `manifest_key`, p.ej. 'gbif' o 'gbif_fungi') y guarda la
    citacion oficial para la atribucion del sitio. Reusable para cualquier reino.
    """
    taxonkey = C.KINGDOM_GBIF_TAXONKEY.get(kingdom, 6)
    out_dir = C.RAW / "gbif"
    out_dir.mkdir(parents=True, exist_ok=True)
    tsv_path = out_dir / f"{download_key}.csv"
    if tsv_path.exists() and not force:
        print(f"[gbif] full ya presente en {tsv_path.name} (usa --force para rebajar)")
        return tsv_path

    zip_path = C.RAW / f"{download_key}.zip"
    url = f"https://api.gbif.org/v1/occurrence/download/request/{download_key}.zip"
    print(f"[gbif] descargando full {url} ...")
    _stream_to(url, zip_path)
    zip_sha = _sha256(zip_path)

    with zipfile.ZipFile(zip_path) as zf:
        # El SIMPLE trae un solo miembro; tomamos el .csv/.txt mas grande.
        members = [m for m in zf.namelist() if m.endswith((".csv", ".txt"))] or zf.namelist()
        member = max(members, key=lambda m: zf.getinfo(m).file_size)
        with zf.open(member) as src, tsv_path.open("wb") as dst:
            for chunk in iter(lambda: src.read(_CHUNK), b""):
                dst.write(chunk)
    tsv_sha = _sha256(tsv_path)

    C.Manifest.load().record(
        manifest_key,
        endpoint="occurrences.download_get",
        kingdom=kingdom,
        download_key=download_key,
        doi=doi,
        url=url,
        zip_sha256=zip_sha,
        tsv_sha256=tsv_sha,
        n=n_expected,
        format="SIMPLE (TSV)",
        predicate=(
            f"country = {C.GBIF_COUNTRY} AND taxonKey = {taxonkey} "
            f"({kingdom}) AND hasCoordinate = TRUE AND hasGeospatialIssue = FALSE"
        ),
        license="ver dataset (mayormente CC BY / CC0)",
        citation=citation,
        note="descarga reproducible por DOI; TSV extraido a data/raw/gbif/",
    )
    n_str = f" (esperado {n_expected})" if n_expected else ""
    print(f"[gbif] full OK -> {tsv_path.name}{n_str}")
    print(f"[gbif] citacion: {citation}")
    return tsv_path


def run(sample: bool = True, force: bool = False) -> None:
    """Orquesta la descarga. sample=True evita GBs (modo validacion)."""
    download_tol(force=force)
    download_peru_geojson_simple(force=force)     # render frontend (siempre)
    download_peru_geojson_detallado(force=force)  # join backend (siempre)
    if sample:
        download_gbif_sample()
        print("[download] modo muestra: WCVP completo y GBIF/DOI quedan para --full")
    else:
        download_wcvp(force=force)
        download_gbif_full()

    # --- Reino Fungi: backbone = GBIF Backbone (Index Fungorum), ocurrencias propias ---
    # El set de hongos es chico (~15k), asi que el search trae el COMPLETO siempre;
    # el DOI reproducible se dispara en --full.
    download_gbif_search_kingdom("Fungi", "fungi_occurrences.json")
    if not sample:
        request_gbif_download_kingdom("Fungi")
