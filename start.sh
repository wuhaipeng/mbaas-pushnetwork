#!/bin/sh

base=$(dirname $(readlink -nf "$0"))

LOG_DIR=$base/log
ENV_FILE=$base/.env

SERVICE=$1
PORT=$2
TEE=$3

usage() {
    echo "Usage: start.sh <service> <port> [tee]"
    exit 1
}

( [ -z "$SERVICE" ] || [ -z "$PORT" ] ) && usage

if [ -f "$ENV_FILE" ]; then
    . "$ENV_FILE"
fi

LOGFN_SUFFIX=""
[ -n "$INSTANCE" ] && LOGFN_SUFFIX="-$INSTANCE"

export DB_CONN REDIS_CONN DEBUG PORT

mkdir -p "$LOG_DIR"
if [ -n "$TEE" ]; then
    exec node "$base/$SERVICE/$SERVICE.js" 2>&1 | tee "$LOG_DIR/${SERVICE}${LOGFN_SUFFIX}.log"
else
    exec node "$base/$SERVICE/$SERVICE.js" >"$LOG_DIR/${SERVICE}${LOGFN_SUFFIX}.log" 2>&1
fi
