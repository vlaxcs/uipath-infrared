from extractor.domain.db_stats import TABLE_LIMIT, db_stats, split_endpoint, truncated


def row(table, size=8192, live=10, seq=0, idx=None, ins=0, upd=0, dele=0, schema="public"):
    return {"schema": schema, "table": table, "size_bytes": size, "live_rows": live, "seq_scans": seq, "idx_scans": idx,
            "n_tup_ins": ins, "n_tup_upd": upd, "n_tup_del": dele}


def test_tables_are_ranked_by_activity_and_marked_observed():
    stats = db_stats([row("cold"), row("hot", seq=5, idx=900, ins=40)], 3, "db:5432/postgres")
    assert [t["table"] for t in stats["tables"]] == ["hot", "cold"]
    assert all(t["provenance"] == "observed" for t in stats["tables"])
    assert stats["indexes"] == 3
    assert stats["connection"] == "db:5432/postgres"


def test_missing_counter_is_omitted_not_zeroed():
    table = db_stats([row("no_index", idx=None)], 0, "x")["tables"][0]
    assert "idx_scans" not in table
    assert table["seq_scans"] == 0


def test_row_estimate_comes_from_live_rows():
    assert db_stats([row("t", live=1234)], 0, "x")["tables"][0]["row_estimate"] == 1234


def test_table_list_is_capped_and_reports_truncation():
    rows = [row(f"t{i}", seq=i) for i in range(TABLE_LIMIT + 5)]
    assert len(db_stats(rows, 0, "x")["tables"]) == TABLE_LIMIT
    assert truncated(rows)
    assert not truncated(rows[:TABLE_LIMIT])


def test_floci_style_endpoint_splits_into_host_and_port():
    assert split_endpoint("172.17.0.2:7004") == ("172.17.0.2", 7004)
