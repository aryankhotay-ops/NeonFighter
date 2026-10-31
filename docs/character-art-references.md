# Character art references and license notes

This project keeps the shipped roster visually original: the game draws Vesper, Nova, Rook,
and Sable from local Phaser vector code rather than hotlinking or redistributing third-party
art. The following animated assets were researched on 2026-10-31 as possible future production
sprite references or replacement pipelines.

## Verified CC0 candidates

- [Free CC0 Modular Animated Vector Characters 2D — RGS_Dev](https://rgsdev.itch.io/free-cc0-modular-animated-vector-characters-2d)
  - CC0; commercial use and modification are permitted and attribution is not required.
  - Includes animated modular vector characters with separately configurable body parts,
    including heads, eyes, and mouths.
  - Best fit for building original identities while retaining Vesper's courier look, Nova's
    bright aerial silhouette, Rook's heavy build, and Sable's long-coated precision style.
- [Godinez Fighter — siwoku](https://siwoku.itch.io/godinez-fighter)
  - CC0; commercial use and modification are permitted and attribution is not required.
  - Includes fighting animations. Separated face/head layers were not verified.
- [Fantasy Martial Characters 3 — LuizMelo](https://luizmelo.itch.io/fantasy-martial-characters-3)
  - CC0; commercial use and modification are permitted and attribution is not required.
  - Includes animated martial-character sprites. Separated face/head layers were not verified.
- [Boxer Game Character — Raga2D / OpenGameArt](https://opengameart.org/content/boxer-game-character)
  - CC0; commercial use and modification are permitted and attribution is not required.
  - Includes animation. Separated face/head layers were not verified.

## Big-head collectible reference

The selection portraits use a general vinyl-collectible/chibi proportion rather than copied
licensed figures or branding. Funko's official [size and variant guide](https://funko.com/funko-blog-home/funko-pops-the-sizes-terms-variants-guide.html)
identifies the common Pop scale at about 3.75 inches (95 mm). Broader design references describe
the recognizable category cues as a head occupying about half of the total height, a very small
body, stubby limbs, simple faces, and large dark eyes. Neon Rivals borrows only those broad
proportional cues; every hairstyle, face device, costume, color scheme, pose, and plinth is an
original fighter-specific vector design, and no Funko logo or licensed character art is used.

## Integration decision

The candidate packs use visibly different pixel/vector scales and do not provide a coherent,
name-matched four-fighter roster as downloaded. Mixing them would weaken the game's visual
identity. The current implementation therefore uses one original vector system:

- **Vesper / courier:** cropped wind-swept hair, cyan comm marker, scarf, lean build.
- **Nova / comet:** swept luminous crest, cheek spark, tall aerial build.
- **Rook / warden:** armored brow, jaw guards, scar, broad heavyweight build.
- **Sable / duelist:** asymmetric fringe, green eye accent, long split coat, tall reach.

Faces animate locally with blinks, focused attack/parry eyes, hurt expressions, and knockout
eyes. The vector art is rasterized into five small textures for each of the two selected fighters
at match setup; gameplay then moves two image quads rather than rebuilding face paths. Bodies use
articulated upper/lower limbs with joints, gloves, boots, costume seams, and fighter-specific
proportions. The Online Play lobby does not load these textures. This avoids external runtime
dependencies and leaves combat simulation and networking data unchanged.

Before shipping any future downloaded sprite pack, archive its exact license text with the
asset, keep the original source URL, and verify every required action (idle, walk, jump, crouch,
guard, hit, knockdown, light, heavy, special, and super) at a consistent scale.
