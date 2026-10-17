// Puts the cursor in the box where the person writes to the coach, once the screen has drawn it.
export function focusComposer(): void {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-composer]')?.focus())
  )
}
