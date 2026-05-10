require('dotenv').config();
const db = require('./db');
const bcrypt = require('bcryptjs');

async function seed() {
    console.log('🌱 Seeding database...');
    try {
        // Super admin
        const hash = await bcrypt.hash('admin123', 12);
        await db.query(`
      INSERT INTO users (email, password_hash, role)
      VALUES ('admin@opendesk.com', $1, 'super_admin')
      ON CONFLICT (email) DO UPDATE SET password_hash=$1
    `, [hash]);
        console.log('✅ Super admin created: admin@opendesk.com / admin123');

        // Demo company (optional)
        const compRes = await db.query(`
      INSERT INTO companies (name, approved, subscription_status)
      VALUES ('Demo Company', TRUE, 'trialing')
      ON CONFLICT DO NOTHING
      RETURNING id
    `);
        if (compRes.rows.length) {
            const cid = compRes.rows[0].id;
            const officeRes = await db.query(`
        INSERT INTO offices (company_id, name, address) VALUES ($1, 'Nairobi HQ', 'Tom Mboya Street, Nairobi') RETURNING id
      `, [cid]);
            const oid = officeRes.rows[0].id;
            const staffHash = await bcrypt.hash('staff123', 12);
            await db.query(`
        INSERT INTO users (company_id, office_id, email, password_hash, role, full_name)
        VALUES ($1, $2, 'staff@demo.com', $3, 'office_staff', 'Jane Staff')
        ON CONFLICT (email) DO NOTHING
      `, [cid, oid, staffHash]);
            const adminHash = await bcrypt.hash('demo123', 12);
            await db.query(`
        INSERT INTO users (company_id, email, password_hash, role, full_name)
        VALUES ($1, 'admin@demo.com', $2, 'company_admin', 'Demo Admin')
        ON CONFLICT (email) DO NOTHING
      `, [cid, adminHash]);
            console.log('✅ Demo company seeded:');
            console.log('   Company Admin: admin@demo.com / demo123');
            console.log('   Office Staff: staff@demo.com / staff123');
        }

        console.log('\n🎉 Seed complete!');
        process.exit(0);
    } catch (err) {
        console.error('Seed error:', err.message);
        process.exit(1);
    }
}

seed();
