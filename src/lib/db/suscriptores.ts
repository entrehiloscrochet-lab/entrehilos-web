export interface Suscriptor {
  id?: number
  created_at?: string
  email: string
  nombre?: string
  activo?: boolean
  fuente?: string
}

export async function insertSuscriptor(data: { email: string; nombre?: string; fuente?: string }) {
  const res = await fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'suscriptor',
      data: {
        email: data.email,
        nombre: data.nombre || null,
        fuente: data.fuente || 'newsletter',
      },
    }),
  })

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}))
    throw new Error(errJson.error || 'Error al suscribirse')
  }

  const json = await res.json().catch(() => ({}))
  return json.duplicate ? 'duplicate' : 'success'
}
