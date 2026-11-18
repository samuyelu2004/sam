#!/bin/sh
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(dirname "$(dirname "$HERE")")
cd "$ROOT"
python3 -m venv .venv 2>/dev/null || true
.venv/bin/pip install -q pillow numpy imageio-ffmpeg
.venv/bin/python "$HERE/render_jesus_dino.py"
