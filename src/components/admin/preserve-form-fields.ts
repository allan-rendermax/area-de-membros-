// React's automatic action reset runs during commit, when its synthetic event
// handlers can be suppressed. A native reset listener keeps every draft control
// (including select/checkbox) intact until the user leaves or saves successfully.
export function preserveFormFields(form: HTMLFormElement | null) {
  if (!form) return
  const preventReset = (event: Event) => event.preventDefault()
  form.addEventListener('reset', preventReset)
  return () => form.removeEventListener('reset', preventReset)
}
