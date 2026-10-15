import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
const env = {};
for (const line of envContent.split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabaseAdmin = createClient(url, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const DEFAULT_PROPERTY_ID = '00000000-0000-0000-0000-000000000001';

const INITIAL_USERS = [
  {
    username: 'umar',
    email: 'umar@thoppu.local',
    password: 'Password123!',
    name: 'Umar',
    role: 'accountant',
  },
  {
    username: 'supervisor',
    email: 'supervisor@thoppu.local',
    password: 'Password123!',
    name: 'Supervisor',
    role: 'supervisor',
  },
  {
    username: 'owner',
    email: 'owner@thoppu.local',
    password: 'Password123!',
    name: 'Owner',
    role: 'owner',
  },
];

async function seed() {
  console.log('Seeding initial users for Thoppu Ledger...');

  for (const u of INITIAL_USERS) {
    console.log(`Checking user: ${u.username} (${u.email})`);
    
    // Check if user already exists in auth
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      console.error('Error listing users:', listError);
      return;
    }

    let authUser = listData.users.find(existing => existing.email === u.email);

    if (!authUser) {
      console.log(`Creating auth user: ${u.email}`);
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: {
          username: u.username,
          name: u.name,
          role: u.role,
        },
      });

      if (createError) {
        console.error(`Error creating auth user ${u.email}:`, createError);
        continue;
      }
      authUser = createData.user;
    } else {
      console.log(`Auth user ${u.email} already exists.`);
    }

    if (authUser) {
      // Upsert profile
      const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
        id: authUser.id,
        property_id: DEFAULT_PROPERTY_ID,
        username: u.username,
        name: u.name,
        role: u.role,
      });

      if (profileError) {
        console.error(`Error upserting profile for ${u.username}:`, profileError);
      } else {
        console.log(`✓ Profile ready for ${u.name} (${u.role})`);
      }
    }
  }

  console.log('\nSeeding completed successfully!');
}

seed();
