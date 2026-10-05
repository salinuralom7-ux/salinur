# Default audio mix (CLAUDE.md Sections 4 & 8)

- Voice chain: `highpass=f=80,afftdn=nf=-25,acompressor=threshold=-18dB:ratio=3:attack=5:release=80`
- Music: start at -24 dB relative to voice, ducked with
  `sidechaincompress=threshold=0.03:ratio=8:attack=20:release=300` keyed from the voice.
- SFX: -20 dB relative to voice, never on a key word.
- Master: `loudnorm=I=-14:TP=-1.5:LRA=11` (two-pass), check final with `ebur128=peak=true` → -14 LUFS, ≤ -1 dBTP.
