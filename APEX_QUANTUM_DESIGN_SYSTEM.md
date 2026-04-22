# Apex Quantum Design System v6.1

## Overview

The Apex Quantum Design System is a comprehensive design language and component library built specifically for the Apex Quantum AI trading platform. It combines cyberpunk aesthetics with functional, data-driven design principles optimized for financial applications.

## Core Design Principles

### 🎨 Visual Language
- **Cyber-Quantum Aesthetic**: Neon cyan (#00f0ff) and magenta (#ff00aa) color palette
- **Dark Theme**: Pure black backgrounds (#0a0a0a) for optimal contrast
- **Glassmorphism**: Semi-transparent cards with blur effects for depth
- **Neon Glow Effects**: Subtle lighting effects for interactive elements

### 📊 Data-Driven Design
- **Real-time Indicators**: Live pulse animations for active data streams
- **Color-Coded States**: Green for profit, red for loss, cyan for neutral
- **Hierarchical Typography**: Clear information architecture for complex data
- **Responsive Grids**: Optimized layouts for desktop trading dashboards

### 🔧 Functional Components
- **Modular UI Library**: Reusable components built with Radix UI + Tailwind
- **Animation System**: Framer Motion for smooth state transitions
- **Accessibility**: WCAG compliant with keyboard navigation
- **Performance**: Optimized for 60fps animations and real-time updates

## Color Palette

### Primary Colors
```css
--neon-cyan: #00f0ff;    /* Primary accent, live indicators */
--neon-magenta: #ff00aa; /* Secondary accent, AI elements */
--background: #0a0a0a;   /* Main background */
--foreground: #fafafa;   /* Primary text */
```

### Semantic Colors
```css
--success: #10b981;      /* Profits, positive actions */
--error: #ef4444;        /* Losses, errors */
--warning: #fbbf24;      /* Warnings, pending states */
--info: #3b82f6;         /* Information, neutral states */
```

### Surface Colors
```css
--card: rgba(17, 17, 19, 0.8);        /* Card backgrounds */
--glass-bg: rgba(17, 17, 19, 0.7);    /* Glassmorphic surfaces */
--border: rgba(39, 39, 42, 0.6);      /* Borders and dividers */
```

## Typography

### Font Stack
- **Primary**: Space Grotesk (display, headings)
- **Monospace**: Geist Mono (code, data tables)
- **Fallback**: System UI fonts

### Scale
```css
--text-xs: 0.75rem;    /* 12px - captions */
--text-sm: 0.875rem;   /* 14px - body text */
--text-base: 1rem;     /* 16px - default */
--text-lg: 1.125rem;   /* 18px - large body */
--text-xl: 1.25rem;    /* 20px - small headings */
--text-2xl: 1.5rem;    /* 24px - headings */
--text-3xl: 1.875rem;  /* 30px - large headings */
```

## Component Library

### Core Components
- **Button**: Multiple variants (primary, secondary, ghost, destructive)
- **Input**: Form inputs with validation states
- **Card**: Glassmorphic containers with hover effects
- **Badge**: Status indicators and labels
- **Tabs**: Navigation tabs for dashboard sections
- **Dialog**: Modal dialogs for confirmations
- **Toast**: Notification system for user feedback

### Trading-Specific Components
- **PriceChart**: Interactive candlestick charts with real-time data
- **PortfolioTable**: Data tables with sorting and filtering
- **TradeLog**: Activity feed with status indicators
- **AIChat**: Conversational interface with typing indicators
- **LiveIndicator**: Animated pulse for active connections

## Animation System

### Keyframe Animations
```css
/* Pulse for live indicators */
@keyframes pulse-glow {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(0, 240, 255, 0.4); }
  50% { opacity: 0.8; box-shadow: 0 0 0 8px rgba(0, 240, 255, 0); }
}

/* Slide-in for notifications */
@keyframes slide-in {
  from { transform: translateX(400px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

/* Quantum particle float */
@keyframes float {
  0%, 100% { transform: translateY(0) translateX(0); }
  25% { transform: translateY(-10px) translateX(5px); }
  50% { transform: translateY(-5px) translateX(-5px); }
  75% { transform: translateY(-15px) translateX(3px); }
}
```

### Framer Motion Presets
- **Fade In**: `initial={{ opacity: 0 }} animate={{ opacity: 1 }}`
- **Slide Up**: `initial={{ y: 20 }} animate={{ y: 0 }}`
- **Scale In**: `initial={{ scale: 0.95 }} animate={{ scale: 1 }}`

## Responsive Design

### Breakpoints
```css
/* Mobile First */
@media (max-width: 640px) { /* Mobile */ }
@media (min-width: 641px) and (max-width: 1024px) { /* Tablet */ }
@media (min-width: 1025px) { /* Desktop */ }
```

### Layout Grid
- **Container**: Max-width 1280px, centered
- **Sidebar**: Fixed 280px left, 320px right
- **Main Content**: Fluid between sidebars
- **Mobile**: Stacked layout with collapsible sidebars

## Implementation Status

✅ **Completed**
- CSS custom properties and design tokens
- Component library with consistent styling
- Animation system and micro-interactions
- Responsive breakpoints and mobile optimization
- Dark theme with glassmorphic effects
- Neon glow effects and cyber aesthetics

🔄 **In Progress**
- Design system documentation
- Component usage guidelines
- Accessibility audit and improvements

📋 **Planned**
- Storybook integration for component development
- Design token management system
- Automated visual regression testing

## Usage Examples

### Basic Card Component
```tsx
<div className="glass-card rounded-xl border border-[rgba(0,240,255,0.1)] p-4">
  <h3 className="text-white font-semibold">Portfolio Overview</h3>
  <p className="text-zinc-400 text-sm">Real-time trading data</p>
</div>
```

### Neon Text Effect
```tsx
<h1 className="neon-text-cyan text-2xl font-bold">
  APEX QUANTUM AI
</h1>
```

### Animated Button
```tsx
<button className="cyber-button bg-gradient-to-r from-[#00f0ff] to-[#00a0ff] text-black font-semibold px-4 py-2 rounded-lg hover:scale-105 transition-transform">
  Execute Trade
</button>
```

---

**Apex Quantum Design System v6.1** © 2026
*Built for the future of autonomous trading*</content>
<parameter name="filePath">/workspaces/apex-quantum-heavyV1/APEX_QUANTUM_DESIGN_SYSTEM.md