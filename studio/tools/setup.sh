#!/usr/bin/env bash
# Installs the studio toolchain. Safe to run again: skips what is already there.
set -euo pipefail
need() { command -v "$1" >/dev/null 2>&1; }
pyhas() { python3 -c "import $1" >/dev/null 2>&1; }

need ffmpeg || { apt-get update -qq && apt-get install -y -qq ffmpeg; }
for pkg in yt-dlp:yt_dlp faster-whisper:faster_whisper auto-editor:auto_editor \
           mediapipe:mediapipe opencv-python-headless:cv2 moviepy:moviepy Pillow:PIL \
           noisereduce:noisereduce scenedetect:scenedetect pyloudnorm:pyloudnorm; do
  pyhas "${pkg#*:}" || pip install -q "${pkg%%:*}"
done
need blender || echo "Blender not installed — install when a video needs 3D (apt-get install blender, or the official tarball for a newer version)."
echo "Studio tools ready."
