# Liquid Glass software renderer fallback

## Change

Saved Liquid Chrome and Line Waves selections still use their chosen effect and appearance setting. When WebGL identifies SwiftShader, llvmpipe, softpipe, or another software rasterizer, the effect renders a reduced resolution still frame and stops its animation loop. Liquid Chrome also skips the fluid simulation on that renderer. Hardware renderers retain their existing pixel budget, animation, and interaction. The fallback is selected from the actual WebGL renderer string; it does not change the saved profile.

## Performance evidence

Measured the production build with headless Chromium at 1440×1000 using the existing six-reload, Study/Dashboard switch, two-animation-frame method. Chromium reported `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) ...), SwiftShader driver)`.

| Flow | Before median | After median |
| --- | ---: | ---: |
| Startup | 1,250 ms | 385 ms |
| Study switch | 2,941 ms | 523 ms |
| Dashboard switch | 2,915 ms | 219 ms |

Before values are the parent agent's six-run production baseline for the saved Liquid Glass profile. After values are the median of the six measurements recorded during this change. Individual after runs varied, including a 1,032 ms Study switch outlier; this is a software-rendered Linux development environment and does not predict Windows hardware performance.

## Verification

- `pnpm check` passed.
- `pnpm build` passed.
- `node --import tsx --test tests/graphics-performance.test.mjs` passed for known software and hardware renderer names.
- No Windows build or native Windows performance measurement was run.
