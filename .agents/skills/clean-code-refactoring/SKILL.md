---
name: clean-code-refactoring
description: Rules for maintaining clean code, SOLID principles, modular architecture, DRY code, and readable component design.
---

# Clean Code & Refactoring Standards

Enforce these engineering practices across all codebase modifications:

## 1. Single Responsibility & DRY
- Each function, module, or component must fulfill exactly one purpose.
- Avoid duplicate code blocks; extract common utilities into helper functions.

## 2. Naming Conventions & Clarity
- Use clear, self-documenting variable and function names (e.g. `calculateTotalAmount()` over `calc()`).
- Avoid arbitrary single-letter variables except for standard loop indices (`i`, `j`).

## 3. Modular Architecture
- Keep UI components, data state, and business logic decoupled in separate files.
- Preserve existing API signatures and prevent unintended side effects when refactoring.
