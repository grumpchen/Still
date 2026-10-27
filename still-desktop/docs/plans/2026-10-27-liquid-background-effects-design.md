# Liquid background effects

Add LineWaves and the supplied monochrome wave artwork as selectable alternatives to LiquidChrome under Appearance settings.

## Design

- Persist a `backgroundEffect` field inside the existing glass appearance settings. Older saved settings without this field continue to select LiquidChrome.
- Render only the chosen background. Keep LiquidChrome and LineWaves pointer responses passive to layout input by listening to global pointer events while the background layer ignores hit testing.
- Use the supplied artwork as a separate static choice. Display the complete image with `contain`, centered over a near-black fill, to preserve its original framing.
- Retain the current Liquid Glass opacity setting and transparent/dots workspace background controls.
- Use a neutral grayscale palette and restrained animation for LineWaves. Fall back to the metallic background fill if WebGL2 is unavailable.

## Acceptance

The Appearance settings expose all three effects, selection persists through the existing workspace state, and choosing the still image shows the complete supplied image without cropping.
