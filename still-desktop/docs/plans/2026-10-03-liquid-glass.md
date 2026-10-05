# Liquid Glass appearance

The user requested an iOS/macOS-inspired Liquid Glass appearance using their leaf photograph, slightly desaturated and defocused. Preserve workspace layout and existing utilities; further resizing and PDF work are deferred. Apply photo effects in CSS to the bundled original image. No image-generation or destructive photo edit is needed.

Use a softly blurred, muted wallpaper beneath translucent surfaces with rounded corners, fine highlight borders, gentle shadows, glass navigation and pill-shaped controls. Keep foreground text sharp and independently readable. Native websites and Desmos retain their own rendering; the glass treatment applies to the surrounding app interface. Support light/dark modes, reduced-motion/transparency preferences and an opaque fallback where backdrop filtering is unavailable.

Appearance offers Quiet minimal and Liquid Glass. New and older profiles start with Liquid Glass for this requested update; an explicit subsequent choice is retained. Glass settings include background blur (0–18px), saturation (40–100%) and opacity (45–90%), initialized to 6px, 78% and 68%. Changes save in the current workspace state without changing notes, widgets, sizes, shortcuts or browser sessions. Invalid/missing numerical values normalize safely.

Verify saved-style migration and numeric normalization, production asset bundling, visual quality in light/dark/grid/lecture views, wallpaper control persistence and style switching; run the existing tests, build the Windows release and deliver a new named executable with a UI screenshot.

Reference: Apple's material and Liquid Glass guidance at https://developer.apple.com/design/human-interface-guidelines/materials . This is a CSS interpretation inside the Windows app, not Apple's native material implementation.
