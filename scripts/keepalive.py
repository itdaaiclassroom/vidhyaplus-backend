#!/usr/bin/env python3
"""
Keep Railway MySQL + Render app warm by periodic pings.

Usage:
  pip install requests pymysql
  python scripts/keepalive.py

Env vars:
  RENDER_HEALTH_URL=https://your-app.onrender.com/api/health
  PING_INTERVAL_SECONDS=240
  REQUEST_TIMEOUT_SECONDS=15

  RAILWAY_MYSQL_HOST=...
  RAILWAY_MYSQL_PORT=39708
  RAILWAY_MYSQL_USER=root
  RAILWAY_MYSQL_PASSWORD=...
  RAILWAY_MYSQL_DATABASE=lms
"""

from __future__ import annotations

import os
import time
import datetime as dt
from typing import Optional

import requests
import pymysql


def now() -> str:
    return dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def log(msg: str) -> None:
    print(f"[{now()}] {msg}", flush=True)


def ping_render(url: str, timeout: int) -> None:
    try:
        r = requests.get(url, timeout=timeout)
        log(f"Render ping: {r.status_code} {url}")
    except Exception as e:
        log(f"Render ping failed: {e}")


def ping_mysql(
    host: str,
    port: int,
    user: str,
    password: str,
    database: str,
    timeout: int,
) -> None:
    conn: Optional[pymysql.connections.Connection] = None
    try:
        conn = pymysql.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            database=database,
            connect_timeout=timeout,
            read_timeout=timeout,
            write_timeout=timeout,
            cursorclass=pymysql.cursors.Cursor,
            autocommit=True,
        )
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
        log(f"Railway MySQL ping: OK ({host}:{port}/{database})")
    except Exception as e:
        log(f"Railway MySQL ping failed: {e}")
    finally:
        if conn is not None:
            conn.close()


def main() -> None:
    render_url = os.getenv("RENDER_HEALTH_URL", "").strip()
    interval = int(os.getenv("PING_INTERVAL_SECONDS", "240"))
    timeout = int(os.getenv("REQUEST_TIMEOUT_SECONDS", "15"))

    mysql_host = os.getenv("RAILWAY_MYSQL_HOST", "").strip()
    mysql_port = int(os.getenv("RAILWAY_MYSQL_PORT", "3306"))
    mysql_user = os.getenv("RAILWAY_MYSQL_USER", "").strip()
    mysql_password = os.getenv("RAILWAY_MYSQL_PASSWORD", "").strip()
    mysql_db = os.getenv("RAILWAY_MYSQL_DATABASE", "").strip()

    if not render_url and not mysql_host:
        raise SystemExit(
            "Set at least one target:\n"
            "- RENDER_HEALTH_URL\n"
            "- or RAILWAY_MYSQL_* vars"
        )

    log("Keepalive started")
    if render_url:
        log(f"Render target: {render_url}")
    if mysql_host:
        log(f"MySQL target: {mysql_host}:{mysql_port}/{mysql_db}")
    log(f"Interval: {interval}s")

    while True:
        if render_url:
            ping_render(render_url, timeout)

        if mysql_host:
            if not (mysql_user and mysql_db):
                log("Skipping MySQL ping: set RAILWAY_MYSQL_USER and RAILWAY_MYSQL_DATABASE")
            else:
                ping_mysql(
                    host=mysql_host,
                    port=mysql_port,
                    user=mysql_user,
                    password=mysql_password,
                    database=mysql_db,
                    timeout=timeout,
                )

        time.sleep(interval)


if __name__ == "__main__":
    main()

