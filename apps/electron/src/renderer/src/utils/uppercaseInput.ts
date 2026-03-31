import { nextTick } from 'vue'

export function applyUppercaseInput(event: Event, apply: (value: string) => void) {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement
  const start = target.selectionStart ?? target.value.length
  const end = target.selectionEnd ?? target.value.length
  const direction = target.selectionDirection ?? 'none'
  const value = target.value.toUpperCase()

  target.value = value
  apply(value)

  void nextTick(() => {
    if (document.activeElement === target) {
      target.setSelectionRange(start, end, direction)
    }
  })
}
