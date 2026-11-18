#!/bin/sh
# One-command rebuild: python3 -m venv .venv && .venv/bin/pip install pillow numpy imageio-ffmpeg && .venv/bin/python render_glass.py
set -e
cd "$(dirname "$0")"
python3 -m venv .venv 2>/dev/null || true
.venv/bin/pip install -q pillow numpy imageio-ffmpeg
.venv/bin/python render_glass.py
