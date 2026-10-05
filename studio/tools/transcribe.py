#!/usr/bin/env python3
"""Word-level transcript: transcribe.py <media> <out_dir> [model]
Writes transcript.json (segments with words + timestamps) and transcript.txt."""
import json, sys, pathlib, subprocess
import numpy as np
from faster_whisper import WhisperModel

src, out = sys.argv[1], pathlib.Path(sys.argv[2])
model = WhisperModel(sys.argv[3] if len(sys.argv) > 3 else "small", device="auto", compute_type="int8")
# Decode with ffmpeg ourselves: faster-whisper's PyAV path breaks when the installed av version differs.
pcm = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", src, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
                     check=True, capture_output=True).stdout
audio = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768.0
segments, info = model.transcribe(audio, word_timestamps=True, vad_filter=False, beam_size=5,
                                  initial_prompt="Salinur, Bongaigaon, Assam, business, personal growth.")
data = {"language": info.language, "duration": info.duration, "segments": []}
lines = []
for s in segments:
    data["segments"].append({"start": s.start, "end": s.end, "text": s.text.strip(),
                             "words": [{"w": w.word.strip(), "start": w.start, "end": w.end} for w in s.words]})
    lines.append(f"[{s.start:6.2f}-{s.end:6.2f}] {s.text.strip()}")
out.mkdir(parents=True, exist_ok=True)
(out / "transcript.json").write_text(json.dumps(data, indent=1, ensure_ascii=False))
(out / "transcript.txt").write_text("\n".join(lines) + "\n")
print(f"{len(lines)} segments, language={info.language}")
