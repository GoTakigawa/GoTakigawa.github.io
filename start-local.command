#!/bin/zsh
set -e

cd "$(dirname "$0")"
PORT=4173

echo "Starting GTI local site at http://localhost:${PORT}"
open "http://localhost:${PORT}"
python3 -m http.server "${PORT}"
