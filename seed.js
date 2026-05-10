require('dotenv').config({ path: './backend/.env' });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
    const client = await pool.connect();
    try {
        console.log('Running migrations...');
        const fs = require('fs');
        const path = require('path');
        const migrationsDir = path.join(__dirname, 'migrations');
        const files = fs.readdirSync(migrationsDir).sort();
        for (const file of files) {
            if (file.endsWith('.sql')) {
                const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
                await client.query(sql);
                console.log(`✓ Ran migration: ${file}`);
            }
        }

        console.log('\nSeeding super admin...');
        const passwordHash = await bcrypt.hash('admin123', 12);

        // Insert super admin (no company)
        const existing = await client.query("SELECT id FROM users WHERE email='admin@opendesk.com'");
        if (existing.rows.length) {
            console.log('Super admin already exists, skipping.');
        } else {
            await client.query(`
        INSERT INTO users (email, password_hash, role)
        VALUES ('admin@opendesk.com', $1, 'super_admin')
      `, [passwordHash]);
            console.log('✓ Super admin created: admin@opendesk.com / admin123');
        }

        // Seed a demo company for development
        const demoCompany = await client.query("SELECT id FROM companies WHERE name='Demo Logistics Ltd'");
        if (!demoCompany.rows.length) {
            await client.query('BEGIN');
            const cRes = await client.query(`
        INSERT INTO companies (name, approved, subscription_status, mpesa_environment)
        VALUES ('Demo Logistics Ltd', TRUE, 'trialing', 'sandbox')
        RETURNING id
      `);
            const cid = cRes.rows[0].id;

            const oRes = await client.query(`
        INSERT INTO offices (company_id, name, address, phone)
        VALUES ($1, 'Nairobi HQ', 'Tom Mboya Street, Nairobi', '0700000001'),
               ($1, 'Mombasa Branch', 'Digo Road, Mombasa', '0700000002')
        RETURNING id`, [cid]
            );
            const office1 = oRes.rows[0].id;
            const office2 = oRes.rows[1].id;

            const adminHash = await bcrypt.hash('company123', 12);
            await client.query(`
        INSERT INTO users (company_id, email, password_hash, role, full_name)
        VALUES ($1, 'admin@demologs.com', $2, 'company_admin', 'Demo Admin')`,
                [cid, adminHash]
            );

            const staffHash = await bcrypt.hash('staff123', 12);
            await client.query(`
        INSERT INTO users (company_id, office_id, email, password_hash, role, full_name)
        VALUES ($1, $2, 'staff.nairobi@demologs.com', $3, 'office_staff', 'John Kamau'),
               ($1, $4, 'staff.mombasa@demologs.com', $3, 'office_staff', 'Fatuma Ali')`,
                [cid, office1, staffHash, office2]
            );

            await client.query('COMMIT');
            console.log('✓ Demo company created: Demo Logistics Ltd');
            console.log('  → Company admin: admin@demologs.com / company123');
            console.log('  → Nairobi staff: staff.nairobi@demologs.com / staff123');
            console.log('  → Mombasa staff: staff.mombasa@demologs.com / staff123');
        }

        console.log('\n✅ Seed complete!');
        console.log('\nDefault credentials:');
        console.log('  Super Admin: admin@opendesk.com / admin123');
        console.log('  Demo Company Admin: admin@demologs.com / company123 (approved + trialing)');
        console.log('  Demo Office Staff (Nairobi): staff.nairobi@demologs.com / staff123');
        console.log('  Demo Office Staff (Mombasa): staff.mombasa@demologs.com / staff123');
    } catch (err) {
        await client.query('ROLLBACK').catch(() => { });
        console.error('Seed failed:', err.message);
        process.exit(1);
    } finally {
        client.release();
        pool.end();
    }
}

seed();
