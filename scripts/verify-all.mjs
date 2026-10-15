import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envText = fs.readFileSync('.env.local', 'utf8')
function getEnv(key) {
  const line = envText.split('\n').find((l) => l.trim().startsWith(key + '='))
  if (!line) return ''
  return line.split('=')[1].trim().replace(/^['"]|['"]$/g, '')
}

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL')
const supabaseAnonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

const client = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  console.log('1. Testing Accountant Authentication...')
  const { data: authData, error: aErr } = await client.auth.signInWithPassword({
    email: 'umar@thoppu.local',
    password: 'Password123!',
  })
  if (aErr) {
    console.error('Accountant login error:', aErr.message)
    return
  }
  console.log('✅ Accountant logged in as:', authData.user.email)

  console.log('\n2. Testing Authenticated Categories Query...')
  const { data: cats, error: cErr } = await client.from('categories').select('*').order('name')
  if (cErr) console.error('Categories error:', cErr.message)
  else {
    console.log(`✅ Fetched ${cats.length} categories:`, cats.map((c) => `${c.name} (${c.type})`).join(', '))
  }

  console.log('\n3. Testing Authenticated Settings Query...')
  const { data: settings, error: sErr } = await client.from('settings').select('*')
  if (sErr) console.error('Settings error:', sErr.message)
  else {
    console.log(`✅ Settings found: Opening Balance = ₹${settings?.[0]?.opening_balance}`)
  }

  console.log('\n4. Testing Authenticated Expenses Query...')
  const { data: exps, error: eErr } = await client.from('expenses').select('*')
  if (eErr) console.error('Expenses error:', eErr.message)
  else {
    console.log(`✅ Expenses count: ${exps.length}`)
  }

  console.log('\n5. Testing Authenticated Deposits Query...')
  const { data: deps, error: dErr } = await client.from('deposits').select('*')
  if (dErr) console.error('Deposits error:', dErr.message)
  else {
    console.log(`✅ Deposits count: ${deps.length}`)
  }

  await client.auth.signOut()
}

run().catch(console.error)
