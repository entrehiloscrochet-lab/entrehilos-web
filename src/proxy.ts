import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse
  }

  const controller = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: init?.signal
              ? AbortSignal.any([init.signal, controller.signal])
              : controller.signal,
          }),
      },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    })

    const sessionPromise = supabase.auth.getSession()
    sessionPromise.catch(() => {})

    await Promise.race([
      sessionPromise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort(new Error('Supabase session timeout'))
          reject(new Error('Supabase session timeout'))
        }, 3000)
      }),
    ])
  } catch (err) {
    console.error('Error o timeout en proxy al verificar sesión:', err)
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/perfil/:path*',
    '/cuenta/:path*',
    '/checkout/:path*',
    '/api/admin/:path*',
    '/api/mis-pedidos/:path*',
    '/api/perfil/:path*',
  ],
}
