import { type NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase/server'
import { sendAdminPushNotification } from '@/lib/push-notifications'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const response = NextResponse.redirect(`${origin}/`)
    const supabase = createSupabaseServerClient(request, response)
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const user = data.session?.user
      if (user) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('rol')
          .eq('id', user.id)
          .maybeSingle()
        if (profile?.rol === 'admin' || profile?.rol === 'super_admin') {
          response.headers.set('Location', `${origin}/admin`)
        }
        if (!profile) {
          await supabaseAdmin.from('profiles').insert({
            id: user.id,
            email: user.email,
            nombre: user.user_metadata?.full_name,
            rol: 'user',
          })
        }

        const createdAtMs = new Date(user.created_at).getTime()
        const isNewUser =
          !profile || (!Number.isNaN(createdAtMs) && Date.now() - createdAtMs < 120_000)

        if (isNewUser) {
          try {
            const nombre =
              (user.user_metadata?.full_name as string | undefined)?.trim() ||
              user.email?.split('@')[0] ||
              'Nuevo cliente'
            await sendAdminPushNotification({
              title: 'Nuevo usuario registrado',
              body: user.email
                ? `${nombre} (${user.email}) se registró con Google.`
                : `${nombre} se registró en Entre Hilos.`,
              url: '/admin?seccion=clientes&sub=usuarios',
              seccion: 'clientes',
              sub: 'usuarios',
              tipo: 'nuevo_usuario',
              tag: `eh-new-user-${user.id}`,
              data: {
                tipo: 'nuevo_usuario',
                userId: user.id,
                email: user.email || '',
              },
            })
          } catch (pushErr) {
            console.warn('[auth/callback] Error enviando push de nuevo usuario:', pushErr)
          }
        }
      }
      return response
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth_error`)
}
