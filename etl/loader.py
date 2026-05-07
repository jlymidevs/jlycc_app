#!/usr/bin/env python3
"""Minimal CSV → staging.stg_person loader.

Usage:
    python loader.py --csv path/to/members.csv

Requires DATABASE_URL environment variable:
    export DATABASE_URL="postgresql://jly_admin:localdevpassword@localhost:5432/jly"

CSV headers are mapped to raw_* columns via HEADER_MAP. Unknown headers are ignored.
"""

import argparse
import os
import sys
from pathlib import Path

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

HEADER_MAP = {
    "first_name": "raw_first_name",
    "last_name": "raw_last_name",
    "middle_name": "raw_middle_name",
    "suffix": "raw_suffix",
    "gender": "raw_gender",
    "birth_date": "raw_birth_date",
    "email": "raw_email",
    "phone": "raw_phone",
    "address_line1": "raw_address_line1",
    "address_line2": "raw_address_line2",
    "city": "raw_city",
    "province": "raw_province",
    "country": "raw_country",
    "postal_code": "raw_postal_code",
    "branch_code": "raw_branch_code",
    "member_code": "raw_member_code",
    "member_stage": "raw_member_stage",
    "joined_date": "raw_joined_date",
    "roles": "raw_roles",
}


def load_csv(csv_path: str, conn_url: str) -> str:
    df = pd.read_csv(csv_path, dtype=str, keep_default_na=False)
    mapped_cols = {}
    for csv_col in df.columns:
        key = csv_col.strip().lower().replace(" ", "_")
        if key in HEADER_MAP:
            mapped_cols[csv_col] = HEADER_MAP[key]

    if not mapped_cols:
        print(f"No recognized columns in {csv_path}. Expected: {list(HEADER_MAP.keys())}")
        sys.exit(1)

    df = df.rename(columns=mapped_cols)
    raw_cols = [c for c in df.columns if c.startswith("raw_")]

    conn = psycopg2.connect(conn_url)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO staging.import_batch (source_name, status) "
                "VALUES (%s, 'LOADING') RETURNING batch_id",
                (Path(csv_path).stem,),
            )
            batch_id = cur.fetchone()[0]

            insert_cols = ["batch_id", "source_row_number"] + raw_cols
            placeholders = ", ".join(["%s"] * len(insert_cols))
            sql = f"INSERT INTO staging.stg_person ({', '.join(insert_cols)}) VALUES ({placeholders})"

            rows = []
            for idx, row in df.iterrows():
                values = [str(batch_id), idx + 1] + [
                    row[c] if row[c] != "" else None for c in raw_cols
                ]
                rows.append(values)

            cur.executemany(sql, rows)

            cur.execute(
                "UPDATE staging.import_batch SET row_count = %s, status = 'LOADED' "
                "WHERE batch_id = %s",
                (len(rows), str(batch_id)),
            )

        conn.commit()
        print(f"Loaded {len(rows)} rows into stg_person (batch_id={batch_id})")
        return str(batch_id)
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="Load CSV into staging.stg_person")
    parser.add_argument("--csv", required=True, help="Path to CSV file")
    args = parser.parse_args()

    conn_url = os.environ.get("DATABASE_URL")
    if not conn_url:
        print("DATABASE_URL environment variable not set")
        sys.exit(1)

    if not Path(args.csv).exists():
        print(f"File not found: {args.csv}")
        sys.exit(1)

    load_csv(args.csv, conn_url)


if __name__ == "__main__":
    main()
