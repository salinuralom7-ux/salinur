#!/usr/bin/env bash
# Pulls apart one reference video for study: decode_reference.sh <url> <name>
# Output in references/<name>/ (git-ignored): video, audio, frames, scene cuts, loudness, transcript, stats.txt
# The written breakdown is done by looking at the frames — this script only gathers the evidence.
set -euo pipefail
url="$1"; name="$2"
cd "$(dirname "$0")/.."
d="references/$name"; mkdir -p "$d/frames" "$d/scenes"

yt-dlp -q -f "bv*[height<=1920]+ba/b" --merge-output-format mp4 -o "$d/video.%(ext)s" \
       --write-info-json --write-thumbnail "$url"
v="$d/video.mp4"

ffmpeg -loglevel error -y -i "$v" -vn -ac 1 -ar 16000 "$d/audio.wav"
ffmpeg -loglevel error -y -i "$v" -vf fps=2,scale=540:-2 "$d/frames/f_%04d.jpg"
# Scene-change frames + their timestamps = the cut list
ffmpeg -hide_banner -i "$v" -vf "select='gt(scene,0.25)',showinfo,scale=540:-2" -vsync vfr \
       "$d/scenes/s_%03d.jpg" 2>&1 | grep -o 'pts_time:[0-9.]*' | cut -d: -f2 > "$d/cuts.txt" || true
ffmpeg -hide_banner -i "$v" -af ebur128=peak=true -f null - 2>&1 | tail -12 > "$d/loudness.txt"
python3 tools/transcribe.py "$d/audio.wav" "$d" small

dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$v")
cuts=$(wc -l < "$d/cuts.txt")
{
  echo "title: $(python3 -c "import json;print(json.load(open('$d/video.info.json'))['title'])")"
  ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate -of csv=p=0 "$v" | sed 's/^/video: /'
  echo "duration_s: $dur"
  echo "scene_cuts: $cuts"
  python3 -c "d=$dur;c=$cuts;print(f'cuts_per_min: {c/d*60:.1f}\navg_shot_s: {d/(c+1):.2f}')"
  echo "words: $(python3 -c "import json;print(sum(len(s['words']) for s in json.load(open('$d/transcript.json'))['segments']))")"
} > "$d/stats.txt"
cat "$d/stats.txt"
echo "Done: $d  — now read frames/ and scenes/ and write the breakdown."
