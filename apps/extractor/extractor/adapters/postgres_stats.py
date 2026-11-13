import psycopg

CONNECT_TIMEOUT_SECONDS = 3
TABLE_STATISTICS = """
    SELECT s.schemaname, s.relname, pg_total_relation_size(s.relid), s.n_live_tup,
           s.seq_scan, s.idx_scan, s.n_tup_ins, s.n_tup_upd, s.n_tup_del
    FROM pg_stat_user_tables s
"""
INDEX_COUNT = "SELECT count(*) FROM pg_stat_user_indexes"
TABLE_COLUMNS = ("schema", "table", "size_bytes", "live_rows", "seq_scans", "idx_scans", "n_tup_ins", "n_tup_upd", "n_tup_del")


class PostgresStatsError(Exception):
    pass


class PostgresStats:
    def __init__(self, password):
        self.password = password

    def read(self, host, port, user, database):
        try:
            return self.query(host, port, user, database)
        except psycopg.Error as error:
            raise PostgresStatsError(" ".join(str(error).split())) from error

    def query(self, host, port, user, database):
        with psycopg.connect(host=host, port=port, user=user, password=self.password, dbname=database,
                             connect_timeout=CONNECT_TIMEOUT_SECONDS, options="-c default_transaction_read_only=on") as connection:
            with connection.cursor() as cursor:
                cursor.execute(TABLE_STATISTICS)
                tables = [dict(zip(TABLE_COLUMNS, row)) for row in cursor.fetchall()]
                cursor.execute(INDEX_COUNT)
                indexes = cursor.fetchone()[0]
        return tables, indexes
