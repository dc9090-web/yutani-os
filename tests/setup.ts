import "@testing-library/jest-dom/vitest";

// Mantine's Menu (via Floating UI) queries ResizeObserver; happy-dom doesn't implement it.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
