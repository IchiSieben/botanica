"""Tests de `etl.export.order_clause` — la pieza que hace el export reproducible.

Corre con la stdlib, sin pytest:

    python -m unittest discover -s tests -v
"""

from __future__ import annotations

import unittest

from etl.export import order_clause


class TestOrderClause(unittest.TestCase):
    def test_ordena_por_todas_las_columnas_en_orden(self):
        # El desempate tiene que llegar hasta la ultima columna: si solo se
        # ordenara por la primera, las filas que empatan en ella volverian a
        # quedar en orden arbitrario y el export dejaria de ser estable.
        self.assertEqual(
            order_clause(["kingdom", "clade", "department"]),
            ' ORDER BY "kingdom" NULLS LAST, "clade" NULLS LAST, "department" NULLS LAST',
        )

    def test_fija_la_posicion_de_los_nulos(self):
        # Sin NULLS LAST la posicion de los nulos depende de la version del
        # motor, y `order_apg` es nullable en mart_family_composition.
        self.assertIn("NULLS LAST", order_clause(["order_apg"]))

    def test_cita_los_identificadores(self):
        # Una columna que choque con una palabra reservada (o que lleve mayusculas)
        # rompe la query si va sin comillas.
        self.assertEqual(order_clause(["order"]), ' ORDER BY "order" NULLS LAST')

    def test_tabla_sin_columnas_no_produce_clausula(self):
        # Concatenar " ORDER BY" vacio dejaria un SELECT invalido.
        self.assertEqual(order_clause([]), "")

    def test_es_determinista(self):
        cols = ["kingdom", "family", "species"]
        self.assertEqual(order_clause(cols), order_clause(list(cols)))

    def test_se_puede_concatenar_a_un_select(self):
        # Asi se usa en run(): f"SELECT * FROM {tbl}{order}". El espacio inicial
        # de la clausula es lo que evita `FROM tblORDER BY`.
        sql = f"SELECT * FROM mart_kpis{order_clause(['kingdom'])}"
        self.assertEqual(sql, 'SELECT * FROM mart_kpis ORDER BY "kingdom" NULLS LAST')


if __name__ == "__main__":
    unittest.main()
