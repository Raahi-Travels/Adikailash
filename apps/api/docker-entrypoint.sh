#!/bin/sh
# Migrate, then serve. Never serve without migrating.
#
# `exec` matters: uvicorn replaces this shell as PID 1, so it receives SIGTERM
# directly and Coolify's graceful stop works. Without it the shell holds PID 1,
# swallows the signal, and every deploy waits out the 10-second kill timeout.
set -e
python -m api.migrate
exec "$@"
