# UI & Design System Reference: Zen Web Application

**Document Name:** Zen UI Specification & Design System  
**Version:** 1.0.0  
**Aesthetic Theme:** Minimalist Dark Luxury / Matte Obsidian with Specular Glow  
**Reference Benchmark:** Minimalist floating capsule with subtle iridescent border glow and frosted glass depth.

---

## 1. Design Philosophy & Aesthetic Core

Zen is designed around extreme visual clarity, intentional whitespace, and subtle tactile depth. Every element emphasizes focus on the prompt and conversation while keeping powerful multimodal and workspace tools non-intrusive.

### Key Visual Tenets:
1. **Matte Obsidian Canvas:** Deep dark backgrounds (`#0a0a0e` to `#121318`) with subtle noise and radial vignette rather than harsh pitch black or flat gray.
2. **Specular Iridescent Rims:** Multi-layered, ultra-fine 1px borders with subtle purple/violet/blue gradients that provide depth without visual noise.
3. **Capsule-First Interaction:** Floating pill-shaped and rounded containers with generous padding, gentle shadows, and smooth micro-animations.
4. **Purposeful Accentuation:** Restrained use of electric blue (`#2563eb` / `#3b82f6`) for primary actions and soft violet (`#9d5bf0`) for intelligence/reasoning states.

---

## 2. Design Tokens & Variables

### 2.1 Color Palette

#### Backgrounds & Surfaces
| Token Name | Value | Usage / Application |
| :--- | :--- | :--- |
| `--bg-viewport` | `#0c0d11` | Root page background with subtle radial vignette |
| `--bg-capsule` | `#121318` | Central input prompt capsule background |
| `--bg-surface-elevated`| `#161720` | Dropdowns, modals, and tooltips |
| `--bg-bubble-user` | `#191b26` | User message bubble |
| `--bg-card-subtle` | `rgba(255, 255, 255, 0.035)` | Pill buttons, suggestion chips, source cards |
| `--bg-card-hover` | `rgba(255, 255, 255, 0.07)` | Hover state for interactive cards and pills |
| `--bg-code-editor` | `#0d0e14` | Code blocks and Canvas code mode background |

#### Borders & Specular Glows
| Token Name | Value | Usage / Application |
| :--- | :--- | :--- |
| `--border-subtle` | `rgba(255, 255, 255, 0.08)` | Default card & pill borders |
| `--border-medium` | `rgba(255, 255, 255, 0.14)` | Hover states, active panels, dividers |
| `--border-glow-capsule`| `linear-gradient(135deg, rgba(145, 95, 135, 0.45), rgba(70, 50, 75, 0.25), rgba(120, 80, 130, 0.35))` | Outer iridescent rim around prompt capsule |
| `--border-focus-glow` | `0 0 24px rgba(140, 90, 130, 0.25)` | Focus ring glow for input capsule |

#### Typography & Text Colors
| Token Name | Value | Usage / Application |
| :--- | :--- | :--- |
| `--text-primary` | `#f1f2f5` | Main headings, user prompt text, active values |
| `--text-secondary` | `#9da3b4` | Assistant body copy, labels, button text |
| `--text-muted` | `#6b7280` | Placeholders, inactive icons, timestamps |
| `--text-watermark` | `#50525d` | Watermark, legal notes, minor subtitles |

#### Brand & Status Accents
| Token Name | Value | Usage / Application |
| :--- | :--- | :--- |
| `--accent-blue` | `#3b82f6` | Send icon, active links, primary action highlights |
| `--accent-blue-bg` | `#0f1d33` | Send button background |
| `--accent-blue-border`| `#1d4ed8` | Send button border ring |
| `--accent-purple` | `#9d5bf0` | Reasoning / "Deep thinking" model badges and glow |
| `--accent-green` | `#10b981` | Low latency / success states, diff additions |
| `--accent-red` | `#ef4444` | Recording pulse, stop button, diff deletions |

---

### 2.2 Typography Scale

* **Primary Font Family:** `'Inter', 'Plus Jakarta Sans', -apple-system, sans-serif`
* **Monospace Font Family:** `'JetBrains Mono', 'Fira Code', monospace`

| Level | Size | Weight | Line Height | Letter Spacing |
| :--- | :--- | :--- | :--- | :--- |
| **Hero Display** | `48px` | 600 (Semi-Bold) | `1.1` | `-0.03em` |
| **Section Title** | `20px` | 600 (Semi-Bold) | `1.3` | `-0.02em` |
| **Prompt Input** | `15px` | 400 (Regular) | `1.5` | `-0.01em` |
| **Assistant Body** | `15px` | 400 (Regular) | `1.65` | `0` |
| **Button / Pill** | `13px` | 400–500 (Medium) | `1.2` | `0` |
| **Badge / Caption** | `11px` | 500–600 (Semi-Bold)| `1.2` | `+0.02em` |
| **Watermark / Subtext**| `11px` | 500 (Medium) | `1.0` | `-0.01em` |

---

### 2.3 Radii & Elevation (Box Shadows)

* **Radius Full / Pill:** `9999px` (Buttons, badges, citations, search pills)
* **Radius Capsule:** `24px` (Central prompt container)
* **Radius Large:** `18px` (Message bubbles, image cards, modal dialogs)
* **Radius Medium:** `12px` (Sidebar cards, code blocks, dropdown menus)
* **Radius Small:** `6px` (Tooltips, action icons, small chips)

#### Elevation Scale:
* **Level 1 (Subtle Card):** `0 2px 8px rgba(0, 0, 0, 0.4)`
* **Level 2 (Dropdown / Modal):** `0 16px 40px -8px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.08)`
* **Level 3 (Floating Capsule):** `0 12px 36px -8px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(120, 80, 115, 0.2)`

---

## 3. Core Component Specifications

```
+-----------------------------------------------------------------------------------------+
|                                    ZEN APPLICATION                                      |
|                                                                                         |
|  +--------------------+  +-----------------------------------+  +--------------------+  |
|  |                    |  | [🧠 Deep thinking ▾]    [Canvas]  |  |                    |  |
|  |                    |  +-----------------------------------+  |   CANVAS PANE      |  |
|  |                    |  |                                   |  |                    |  |
|  |                    |  |         MESSAGES STREAM           |  | - Document Mode    |  |
|  |  SIDEBAR           |  |                                   |  | - Code Mode        |  |
|  |                    |  | User Bubble                       |  | - Diff Viewer      |  |
|  | - Search           |  | Assistant (Streaming / Citations) |  | - "Ask Zen" Inline |  |
|  | - Projects         |  |                                   |  | - Quick Actions    |  |
|  | - History Groups   |  |                                   |  |                    |  |
|  | - Pinned Chats     |  +-----------------------------------+  |                    |  |
|  |                    |  | [How can I help you?            ] |  |                    |  |
|  |                    |  | [📎 Attach] [🧠 Deep thinking ▾] ✈ |  |                    |  |
|  +--------------------+  +-----------------------------------+  +--------------------+  |
+-----------------------------------------------------------------------------------------+
```

---

### 3.1 The Floating Zen Prompt Capsule (Primary Hero Element)

The signature visual component of the application.

* **Layout:** Centered horizontally, positioned with `max-width: 630px` and adaptive vertical alignment (centered on zero-state, pinned to bottom on active conversation).
* **Outer Glow Rim:** 1px perimeter gradient (`#915f87` to `#46324b`) with `box-shadow` depth and `border-radius: 24px`.
* **Inner Container:** Background `#121318`, padding `18px 18px 14px 20px`.
* **Top Input Area:**
  * Frameless auto-expanding textarea / input.
  * Placeholder: `"How can I help you?"` in `#e2e4ea`.
* **Bottom Controls Row:**
  * **Left Side:**
    * `[📎 Attach files]` Pill button (`border-radius: 9999px`, background `rgba(255,255,255,0.035)`, border `1px solid rgba(255,255,255,0.08)`, color `#8c8f9c`).
    * `[🧠 Deep thinking ▾]` Pill button with model tag, capability indicator, and downward chevron.
  * **Right Side:**
    * Circular Send Button (`36px x 36px`, background `#0f1d33`, border `1px solid #1d4ed8`, icon color `#3b82f6`, hover glow `#2563eb`).

---

### 3.2 Model Selector & Capability Badges

* **Dropdown Trigger:** Model badge in top navigation bar or inside prompt capsule pill.
* **Dropdown Popover:** Frosted glass overlay with 3 tiered model cards:
  1. **Deep thinking (Zen-R1):** Purple theme (`#bf8eff`), tag: *Reasoning*. Multi-step math, logic & deep coding.
  2. **Zen Ultra (4.5):** Blue theme (`#8cb4ff`), tag: *Creative*. Long-form synthesis & multimodal intelligence.
  3. **Zen Flash:** Green theme (`#6ee7b7`), tag: *Low-Latency*. Instantaneous response for high-throughput queries.

---

### 3.3 Message Stream & Rich Output Blocks

* **User Message Bubble:** Right-aligned, `#191b26` background, `18px` border-radius with bottom-right notch, subtle border `rgba(255,255,255,0.08)`.
* **Assistant Message View:** Left-aligned, preceded by an ambient glow avatar orb (32px radial gradient `#9d5bf0` -> `#2d68f6`).
* **Branching Navigation (`< 1/2 >`):** Pagination pill in message header to switch between alternative model outputs or edited branches.
* **Code Block:** `#0d0f17` container, JetBrains Mono font, top header bar displaying detected language, line numbers, and a 1-click **"Copy Code"** button.
* **Inline Citations:** Circular badge pill (`[1]`, `[2]`) in `#2d68f6` translucent tint. Hovering opens an elevated preview card with domain favicon, title, and excerpt.
* **Image Generation Card:** Rounded container (`border-radius: 18px`) with dark caption footer, full-resolution zoom trigger, and prompt modification pill.
* **Audio Playback Visualizer:** Animated 4-bar equalizer (`#9d5bf0`) displaying playback speed pill (`1.0x`, `1.5x`, `2.0x`) and scrub progress.

---

### 3.4 Canvas & Interactive Workspace (Dual-Pane)

* **Split Layout:** 
  * Left pane: Conversation thread (`flex: 1`).
  * Right pane: Canvas document / code editor (`width: 540px` or 50% split).
* **Document Mode:** Rich text editing with title header, reading level selector, and auto-polish toolbar.
* **Code Mode:** Monospace IDE layout with syntax highlighting and action toolbar (*Add Comments*, *Add Logs*, *Fix Bugs*, *Port Language*).
* **Inline "Ask Zen" Floating Tooltip:** Pops up immediately above highlighted text/code in Canvas with an input bar allowing targeted revisions on just the selected excerpt.
* **Version Diff Viewer:** Side-by-side or inline diff highlighting:
  * Green background for additions (`rgba(16, 185, 129, 0.15)`).
  * Red strikethrough for deletions (`rgba(239, 68, 68, 0.15)`).

---

### 3.5 History Sidebar & Project Organization

* **Collapsible Drawer:** `280px` width, background `#090a0f`.
* **Search Input:** Real-time query matching across thread titles and message bodies.
* **Temporal Grouping:** Categorized into *Pinned*, *Today*, *Yesterday*, *Previous 7 Days*, *Previous 30 Days*.
* **Projects / Folders:** Color-coded workspace pills (*General*, *Q3 Campaign*, *Core AI Engine*).
* **Ephemeral Mode Toggle:** Incognito mask icon indicating temporary session with no storage retention.

---

## 4. Interaction States & Transitions

### Micro-Interactions:
* **Pill Hover:** Background shifts from `rgba(255,255,255,0.035)` to `rgba(255,255,255,0.06)`, text brightens from `#8c8f9c` to `#bbbfc9`.
* **Send Button Hover:** Shadow expands with `0 0 16px rgba(37, 99, 235, 0.35)`, border brightens to `#2563eb`.
* **Capsule Focus:** Outer gradient border sharpens with an ambient `rgba(140, 90, 130, 0.25)` drop glow.
* **Message Entry Animation:** `translateY(8px)` to `translateY(0)` with `opacity: 0` to `opacity: 1` over `250ms cubic-bezier(0.16, 1, 0.3, 1)`.

---

## 5. Responsive Behavior

| Breakpoint | Layout Adjustments |
| :--- | :--- |
| **Desktop (> 1200px)** | Full dual-pane view (Sidebar + Chat View + Canvas Workspace simultaneously open). |
| **Tablet (768px – 1199px)** | Sidebar collapses into hamburger drawer; Canvas opens as an overlay drawer. |
| **Mobile (< 768px)** | Capsule width adapts to `100% - 32px`; single column stack; modals become bottom sheets. |
