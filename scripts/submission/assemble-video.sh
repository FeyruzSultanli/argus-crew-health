#!/usr/bin/env bash
# Assemble ARGUS-video-draft.mp4 and ARGUS-video-nocamera.mp4 (+ captions.srt) from the recorded shots.
# Needs: ffmpeg + ffprobe on PATH (or FFMPEG=/path/ffmpeg FFPROBE=/path/ffprobe), the shots in
# docs/submission/video/raw/ (npm run video:record), optionally docs/submission/video/shot-camera.mp4.
set -euo pipefail
cd "$(dirname "$0")/../.."
command -v "${FFMPEG:-ffmpeg}" >/dev/null || { echo "ffmpeg not found (brew install ffmpeg)"; exit 1; }
exec node scripts/submission/assemble-video.mjs "$@"
