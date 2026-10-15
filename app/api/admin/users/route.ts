import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !userData.user) {
      return NextResponse.json({ error: 'Invalid authentication session' }, { status: 401 })
    }

    // Check if caller is accountant
    const { data: callerProfile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('role, property_id')
      .eq('id', userData.user.id)
      .single()

    if (profileErr || callerProfile?.role !== 'accountant') {
      return NextResponse.json({ error: 'Only accountants can create user accounts' }, { status: 403 })
    }

    const body = await req.json()
    const { username, password, name, role } = body

    if (!username || !password || !name || !role) {
      return NextResponse.json({ error: 'Username, password, name and role are required' }, { status: 400 })
    }

    const cleanUsername = username.trim().toLowerCase()
    const email = cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@thoppu.local`

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username: cleanUsername,
        name,
        role,
      },
    })

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    const { error: insertProfileErr } = await supabaseAdmin.from('profiles').insert({
      id: newUser.user.id,
      property_id: callerProfile.property_id,
      username: cleanUsername,
      name,
      role,
    })

    if (insertProfileErr) {
      return NextResponse.json({ error: insertProfileErr.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.user.id,
        username: cleanUsername,
        name,
        role,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
