import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pyvvxvzcuydmrlvuiowh.supabase.co'
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is not configured.')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Helper to authenticate caller as accountant
async function authenticateAccountant(req: NextRequest, supabaseAdmin: ReturnType<typeof getAdminClient>) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return { error: 'Missing authorization header', status: 401 }
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token)

  if (authError || !userData.user) {
    return { error: 'Invalid authentication session', status: 401 }
  }

  const { data: callerProfile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('id, role, property_id')
    .eq('id', userData.user.id)
    .single()

  if (profileErr || callerProfile?.role !== 'accountant') {
    return { error: 'Only accountants can manage user accounts', status: 403 }
  }

  return { caller: callerProfile }
}

// GET /api/admin/users - Returns users with active/inactive status
export async function GET(req: NextRequest) {
  try {
    const supabaseAdmin = getAdminClient()
    const authResult = await authenticateAccountant(req, supabaseAdmin)
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { data: authData } = await supabaseAdmin.auth.admin.listUsers()
    const bannedMap = new Map<string, boolean>()
    for (const u of authData?.users || []) {
      bannedMap.set(u.id, !!(u.banned_until && new Date(u.banned_until) > new Date()))
    }

    const { data: profiles, error: pErr } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })

    if (pErr) throw pErr

    const enriched = (profiles || []).map((p) => ({
      ...p,
      is_banned: bannedMap.get(p.id) || false,
    }))

    return NextResponse.json({ users: enriched })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/users - Creates a new user
export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getAdminClient()
    const authResult = await authenticateAccountant(req, supabaseAdmin)
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    const { caller } = authResult

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
      property_id: caller.property_id,
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

// PATCH /api/admin/users - Toggle user Active / Inactive (ban / unban)
export async function PATCH(req: NextRequest) {
  try {
    const supabaseAdmin = getAdminClient()
    const authResult = await authenticateAccountant(req, supabaseAdmin)
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    const { caller } = authResult

    const body = await req.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    if (userId === caller.id) {
      return NextResponse.json({ error: 'You cannot deactivate your own account' }, { status: 400 })
    }

    const { data: targetUser, error: getErr } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (getErr || !targetUser?.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isBanned = !!(targetUser.user.banned_until && new Date(targetUser.user.banned_until) > new Date())
    const newBanDuration = isBanned ? 'none' : '876000h' // 100 years

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: newBanDuration,
    })

    if (updateErr) throw updateErr

    return NextResponse.json({
      success: true,
      is_banned: !isBanned,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/users - Delete supervisor (only if 0 recorded expenses)
export async function DELETE(req: NextRequest) {
  try {
    const supabaseAdmin = getAdminClient()
    const authResult = await authenticateAccountant(req, supabaseAdmin)
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    const { caller } = authResult

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    if (userId === caller.id) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
    }

    // Check if target user has recorded expenses
    const { count, error: expErr } = await supabaseAdmin
      .from('expenses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (expErr) throw expErr

    if (count && count > 0) {
      return NextResponse.json(
        {
          error: `Cannot permanently delete this member because they are linked to ${count} recorded expense(s) in your farm ledger. Please Deactivate them instead to preserve historical records.`,
        },
        { status: 400 }
      )
    }

    // Safe to delete (0 expenses linked)
    await supabaseAdmin.from('profiles').delete().eq('id', userId)
    await supabaseAdmin.auth.admin.deleteUser(userId)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
