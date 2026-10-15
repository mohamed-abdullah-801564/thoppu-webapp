import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envText = fs.readFileSync('.env.local', 'utf8')
function getEnv(key) {
  const line = envText.split('\n').find((l) => l.trim().startsWith(key + '='))
  return line ? line.split('=')[1].trim().replace(/^['"]|['"]$/g, '') : ''
}

const url = getEnv('NEXT_PUBLIC_SUPABASE_URL')
const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')
const anonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

const adminClient = createClient(url, serviceKey)
const userClient = createClient(url, anonKey)

async function test() {
  // Test accountant login
  const { data: auth, error: aErr } = await userClient.auth.signInWithPassword({
    email: 'umar@thoppu.local',
    password: 'Password123!',
  })
  if (aErr) {
    console.error('Accountant login error:', aErr.message)
    return
  }

  // Create dummy category as accountant
  const { data: newCat, error: insertErr } = await userClient.from('categories').insert({
    property_id: '00000000-0000-0000-0000-000000000001',
    name: 'Temporary Test Category',
    type: 'Farm',
    active: true,
  }).select().single()

  if (insertErr) {
    console.error('Insert error:', insertErr.message)
    return
  }
  console.log('✅ Created category:', newCat.name, newCat.id)

  // Try deleting as authenticated accountant
  const { error: deleteErr } = await userClient.from('categories').delete().eq('id', newCat.id)
  if (deleteErr) {
    console.log('⚠️ Delete with user client failed (RLS policy missing):', deleteErr.message)
    // Delete with adminClient
    const { error: adminDelErr } = await adminClient.from('categories').delete().eq('id', newCat.id)
    if (adminDelErr) {
      console.error('Admin delete failed:', adminDelErr.message)
    } else {
      console.log('✅ Deleted via adminClient successfully!')
    }
  } else {
    console.log('✅ User client deleted category successfully directly!')
  }
}

test().catch(console.error)
