# Combat design references

Research date: 2026-10-29

Neon Rivals uses original characters, arena art, move names, source code, timings, and balance values. The references below were used only to understand broad mechanics from _Street Fighter III: New Generation_ and the conventions of 2D arcade fighting games.

## Researched reference behavior

- Matches use one-on-one rounds with a timer and life-based KO/time-over results.
- Movement includes walking, forward/back dashes, jumps, high/super jumps, and quick recovery after eligible knockdowns.
- Ground blocking uses back for standing defense and down-back for low defense; air blocking is absent in New Generation.
- A high/mid/air parry is attempted by tapping toward the opponent, while a low parry is attempted by tapping down near impact. Successful parries avoid damage and blockstun.
- Specials and super attacks can deal chip damage when blocked.
- Super gauges build through combat, persist between rounds, and enable a selected high-impact Super Art. Special-to-super cancellation is part of the reference game's combo structure.
- New Generation supports quick standing after eligible knockdowns, but not after Super Art knockdowns.
- Later-series mechanics were not silently mixed in: red/guard parry belongs to _3rd Strike_, not _New Generation_.

## Original Neon Rivals adaptation

The implementation deliberately changes the content and numbers:

- The arena is the original **Neon Transit Deck**, rendered from project-owned geometric art.
- The original roster is Vesper, Nova, Rook, and Sable; none is a Street Fighter character or likeness.
- Each fighter has original normals, one special move, and one Super Art stored in an independent reusable configuration.
- The release prototype uses a seven-frame parry buffer, integer subpixel movement, original startup/active/recovery values, and a 1,000-point life/meter scale.
- A confirmed chain currently supports light → heavy → special → super. This is a small, testable first combo system rather than a copied character move list.
- Holding away blocks mids, down-away blocks lows, and standing away blocks the placeholder overhead. Tap-toward/down parry windows take priority over blocking.
- Special moves cause eligible quick-rise knockdowns. Each original Super Art prevents quick rise.
- The first player to win two rounds wins the match. Equal health at timeout is a draw rather than reproducing the reference game's judge system.

## Sources

- [Street Fighter III: New Generation — Street Fighter Wiki](https://streetfighter.fandom.com/wiki/Street_Fighter_III:_New_Generation)
- [Street Fighter 3: New Generation/System — SuperCombo Wiki](https://wiki.supercombo.gg/w/Street_Fighter_3:_New_Generation/System)
- [Street Fighter III/Gameplay — StrategyWiki](https://strategywiki.org/wiki/Street_Fighter_III/Gameplay)
- [Street Fighter III: New Generation arcade manual](https://files.stardustarcade.com/PDF_Arcade_Manuals_and_Schematics/Street%20Fighter%203%20New%20Generation.pdf)
- [Street Fighter III: New Generation move list and guide — GameFAQs](https://gamefaqs.gamespot.com/arcade/583627-street-fighter-iii-new-generation/faqs/853)

These sources are factual design references only. No source code, ripped assets, copyrighted characters, stages, audio, or character-specific move data were imported into the project.
