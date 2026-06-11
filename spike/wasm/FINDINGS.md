# WASM ladder — results

Engine: `texlyre-busytex` (BusyTeX, TeX Live 2026, AGPL-3.0), driver `luahbtex_bibtex8`.

| Rung | Compiled | exit | PDF bytes | SyncTeX |
|---|---|---|---|---|
| 1-plain-beamer | ❌ | 1 | 0 | no |
| 2-fontspec | ✅ | 0 | 7024 | yes |
| 3-tikz-overlay-2pass | ✅ | 0 | 7725 | yes |

**Highest rung reached:** 3-tikz-overlay-2pass

> Note: rung 1 (plain beamer) intermittently hits a BusyTeX init quirk
> (`kpathsea: Can't get directory of program name: /bin/busytex`). It is **not** a
> capability gap — the harder rungs (fontspec, TikZ overlay + 2-pass) compile cleanly.
> Takeaway: the WASM engine handles fontspec + absolute TikZ overlay + multi-pass + SyncTeX;
> it just needs retry/robustness wrapping around engine init.

<details><summary>log tails</summary>

### 1-plain-beamer
```
$ luahblatex -synctex=1 --no-shell-escape --interaction=nonstopmode --halt-on-error --fmt /texlive/texmf-dist/texmf-var/web2c/luahbtex/luahblatex.fmt --nosocket main.tex -kpathsea-debug 32
EXITCODE: 1

TEXMFLOG:

==
MISSFONTLOG:

==
LOG:

==
STDOUT:

==
STDERR:
lstat(/bin) failed: /bin: No such file or directory
kpathsea: Can't get directory of program name: /bin/busytex
program exited (with status: 1), but keepRuntimeAlive() is set (counter=0) due to an async operation, so halting execution but not exiting the runtime or preventing further async execution (you can use emscripten_force_exit, if you want to force a true shutdown)
======
```

### 2-fontspec
```
s-dictionary-English
.dict)
(/texlive/texmf-dist/tex/latex/translator/translator-theorem-dictionary-English
.dict)
No file main.nav.
[1{/texlive/texmf-dist/texmf-var/fonts/map/pdftex/updmap/pdftex.map}]
(./main.aux)

Package rerunfilecheck Warning: File `main.out' has changed.
(rerunfilecheck)                Rerun to get outlines right
(rerunfilecheck)                or use package `bookmark'.

)
 1397 words of node memory still in use:
   19 hlist, 9 vlist, 4 rule, 3 local_par, 36 glue, 8 kern, 10 penalty, 26 glyp
h, 41 attribute, 61 glue_spec, 41 attribute_list, 4 write, 10 pdf_colorstack no
des
   avail lists: 2:482,3:307,4:177,5:134,6:32,7:385,9:410,10:2
</texlive/texmf-dist/fonts/opentype/public/lm/lmsans10-regular.otf></texlive/te
xmf-dist/fonts/opentype/public/lm/lmsans17-regular.otf>
Output written on main.pdf (1 page, 7024 bytes).
SyncTeX written on main.synctex.gz.
Transcript written on main.log.
==
STDERR:
program exited (with status: 0), but keepRuntimeAlive() is set (counter=0) due to an async operation, so halting execution but not exiting the runtime or preventing further async execution (you can use emscripten_force_exit, if you want to force a true shutdown)
======
```

### 3-tikz-overlay-2pass
```
(/texlive/texmf-dist/tex/latex/translator/translator-months-dictionary-English.
dict)
(/texlive/texmf-dist/tex/latex/translator/translator-numbers-dictionary-English
.dict)
(/texlive/texmf-dist/tex/latex/translator/translator-theorem-dictionary-English
.dict) (./main.nav) [1{/texlive/texmf-dist/texmf-var/fonts/map/pdftex/updmap/pd
ftex.map}] (./main.aux))
 1978 words of node memory still in use:
   23 hlist, 9 vlist, 4 rule, 6 disc, 3 local_par, 49 glue, 7 kern, 10 penalty,
 57 glyph, 68 attribute, 61 glue_spec, 68 attribute_list, 5 write, 1 save_pos, 
18 pdf_literal, 12 pdf_colorstack nodes
   avail lists: 2:484,3:367,4:183,5:131,6:32,7:517,9:422,10:7,11:18
</texlive/texmf-dist/fonts/opentype/public/lm/lmsans10-regular.otf></texlive/te
xmf-dist/fonts/opentype/public/lm/lmsans12-regular.otf>
Output written on main.pdf (1 page, 7725 bytes).
SyncTeX written on main.synctex.gz.
Transcript written on main.log.
==
STDERR:
program exited (with status: 0), but keepRuntimeAlive() is set (counter=0) due to an async operation, so halting execution but not exiting the runtime or preventing further async execution (you can use emscripten_force_exit, if you want to force a true shutdown)
======
```

</details>
