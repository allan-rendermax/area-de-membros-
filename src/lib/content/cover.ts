const TONES = ['#3f0d12', '#1e1b4b', '#052e2b', '#3b0764', '#422006', '#172554', '#4a044e', '#27272a']

export function coverGradient(seed: string): string {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return `linear-gradient(160deg, ${TONES[hash % TONES.length]} 0%, #0b0b0c 85%)`
}
