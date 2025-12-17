# 🐾 Pettzi Design System

**Version:** 1.0  
**Status:** Active  
**Scope:** Web Application (Angular, Responsive)

---

## 1. Introduction

The **Pettzi Design System** defines the visual language, design tokens, and foundational UI components used across the Pettzi platform.

It ensures a consistent, accessible, and scalable user experience for a modern SaaS focused on pet care management.

This system is designed for:
- A responsive web application (mobile-first)
- Future mobile applications
- A balance between emotional warmth and professional clarity

---

## 2. Design Principles

1. **Warm but Professional**  
   Friendly and empathetic without feeling childish.

2. **Clarity First**  
   Health and event information must be understandable at a glance.

3. **Card-Based UI**  
   Core information is presented using cards: pets, events, documents, reminders.

4. **Mobile-First, Desktop-Complete**  
   Designed for mobile, enhanced for larger screens.

5. **Consistency Over Isolated Creativity**  
   Reusable patterns take precedence over one-off designs.

---

## 3. Color Palette

### 3.1 Primary (Brand)

| Token | Value | Usage |
|-----|------|------|
| `--color-primary-500` | `#7C7CFF` | CTAs, links, headers |
| `--color-primary-600` | `#6A6AE8` | Hover and active states |
| `--color-primary-100` | `#EFEFFF` | Soft backgrounds |

---

### 3.2 Secondary (Status Colors)

#### Success / Health
- `--color-success-500`: `#4ADE80`
- `--color-success-100`: `#E9FDF2`

#### Warning / Reminders
- `--color-warning-500`: `#F59E0B`
- `--color-warning-100`: `#FEF3C7`

#### Error / Overdue
- `--color-danger-500`: `#FB7185`
- `--color-danger-100`: `#FFE4E6`

#### Info
- `--color-info-500`: `#38BDF8`
- `--color-info-100`: `#E0F2FE`

---

### 3.3 Neutral Colors

| Token | Value |
|-----|------|
| `--color-text-primary` | `#111827` |
| `--color-text-secondary` | `#6B7280` |
| `--color-text-disabled` | `#9CA3AF` |
| `--color-bg-app` | `#F9FAFB` |
| `--color-bg-card` | `#FFFFFF` |
| `--color-border-soft` | `#E5E7EB` |
| `--color-divider` | `#F3F4F6` |

---

## 4. Typography

### 4.1 Primary Font

- **Inter** (recommended)
- Alternatives: Nunito, Poppins

---

### 4.2 Type Scale

| Usage | Size | Line Height | Weight |
|---|---|---|---|
| Page Title (H1) | 28px | 34px | 600 |
| Section Title (H2) | 22px | 28px | 600 |
| Card Title (H3) | 18px | 24px | 500 |
| Body Text | 14px | 20px | 400 |
| Small / Meta | 12px | 16px | 400 |

---

## 5. Spacing & Layout

### 5.1 Spacing Scale (4px base)

| Token | Value |
|---|---|
| `xs` | 4px |
| `sm` | 8px |
| `md` | 16px |
| `lg` | 24px |
| `xl` | 32px |
| `2xl` | 48px |

**Rules**
- Card padding: 16–24px
- Section spacing: 24–32px
- Avoid arbitrary spacing values

---

## 6. Borders & Shadows

### 6.1 Border Radius

| Element | Radius |
|---|---|
| Inputs / Chips | 8px |
| Cards | 16px |
| Modals / Sheets | 24px |

---

### 6.2 Shadows

**Card Default**

```code
0 4px 12px rgba(0, 0, 0, 0.05)
```

**Hover / Focus**

```code
0 6px 16px rgba(0, 0, 0, 0.08)
```

---

## 7. Core Components

### 7.1 Buttons

**Primary**
- Background: Primary 500
- Text: White
- Height: 44px
- Radius: 12px

**Secondary**
- Background: Primary 100
- Text: Primary 600

**Ghost**
- Background: Transparent
- Text: Primary 500

**States**
- Hover: Darker background
- Disabled: 50% opacity

---

### 7.2 Inputs

- Height: 44px
- Radius: 12px
- Border: Soft border
- Focus:
  - Border Primary 500
  - Subtle shadow

Error state:

- Border Danger 500
- Helper text visible

---

### 7.3 Cards

- White background
- Radius: 16px
- Padding: 16–24px
- Optional header and footer

---

### 7.4 Chips / Badges

- Padding: 6px 10px
- Font size: 12px
- Radius: 999px (pill)
- Color reflects state (success, warning, danger, info)

---

## 8. Iconography

- Recommended libraries:
  - Lucide Icons
  - Heroicons
- Style:
  - Outline only
  - Stroke width: 1.5–2px
- Do not mix outline and filled styles

Key icons:

- Pet / Paw
- Calendar
- Heart / Health
- Document
- Bell / Reminder
- Upload
- User

---

## 9. System States

### Loading
- Skeleton loaders for cards and lists
- Spinners only for small actions

### Empty States
- Friendly illustration
- Empathetic message
- Clear call to action

### Success
- Check icon
- Short confirmation message

### Error
- Clear explanation
- Suggested action (Retry / Go back)

---

## 10. Responsive Behavior

### Mobile
- Single column layout
- Full-width cards
- Bottom navigation

### Tablet
- Two columns
- Collapsible sidebar

### Desktop
- Fixed sidebar
- Max content width: 1280px
- Grids with 2–4 columns

---

## 11. Angular Implementation Guidelines

- Centralize design tokens using:
  - CSS variables
  - Tailwind configuration
  - SCSS maps
- Build an internal UI library:
  - `<pettzi-button>`
  - `<pettzi-card>`
  - `<pettzi-chip>`
  - `<pettzi-input>`

---

## 12. Future Evolution

- Dark mode
- Brand theming (B2B)
- Micro-interactions
- Native mobile components

---

**This document is the single source of truth for Pettzi’s UI and visual language.**  
All new features and components must align with this system.