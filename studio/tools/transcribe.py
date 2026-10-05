#!/usr/bin/env python3
"""Word-level transcript: transcribe.py <media> <out_dir> [model]
Writes transcript.json (segments with words + timestamps) and transcript.txt."""
import json, sys, pathlib
from faster_whisper import WhisperModel

src, out = sys.argv[1], pathlib.Path(sys.argv[2])
model = WhisperModel(sys.argv[3] if len(sys.argv) > 3 else "small", device="auto", compute_type="int8")
segments, info = model.transcribe(src, word_timestamps=True, vad_filter=True)
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
