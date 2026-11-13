// ── RESPONSE STANDARDIZATION UTILITIES ──
// All API responses should follow { success, data, error, total } shape
// This helper safely extracts arrays/items from inconsistent response shapes
export function extractArrayFromResponse(response: any, fallbackArrays: string[] = []): any[] {
  // Direct array response
  if (Array.isArray(response)) return response

  // Try response.data first (most common)
  if (Array.isArray(response.data)) return response.data

  // Try nested arrays (res.data.items, res.data.animals, etc.)
  for (const key of fallbackArrays) {
    if (Array.isArray(response.data?.[key])) return response.data[key]
  }

  // Fallback: if response.data is an object, try common item keys
  const data = response.data || response
  if (typeof data === 'object' && !Array.isArray(data)) {
    for (const key of ['items', 'data', 'animals', 'users', 'records', 'consultations', 'bookings']) {
      if (Array.isArray(data[key])) return data[key]
    }
  }

  return []
}

export function extractTotalFromResponse(response: any): number {
  return response.total || response.data?.total || 0
}



