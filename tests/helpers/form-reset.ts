import { vi } from 'vitest'

// happy-dom 20 resets values before emitting its cancelable reset event. Real
// browsers emit it first and honor preventDefault. Match that browser behavior
// while exercising React's own automatic reset after a form action resolves.
export function mockCancelableFormReset() {
  const original = HTMLFormElement.prototype.reset
  vi.spyOn(HTMLFormElement.prototype, 'reset').mockImplementation(function (this: HTMLFormElement) {
    if (this.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }))) original.call(this)
  })
}
