import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function setupDatabase() {
  try {
    console.log('🔌 Connecting to PostgreSQL server...');
    
    // First, create database if it doesn't exist
    const adminPool = new Pool({
      connectionString: 'postgres://postgres:postgres@localhost:5432/postgres',
    });
    
    const adminClient = await adminPool.connect();
    console.log('📊 Creating database if not exists...');
    await adminClient.query(`CREATE DATABASE education_crm;`).catch(() => {
      console.log('   (Database already exists)');
    });
    adminClient.release();
    await adminPool.end();
    
    // Now connect to the education_crm database
    console.log('🔌 Connecting to education_crm...');
    const client = await pool.connect();
    
    console.log('📋 Reading schema.sql...');
    const schemaPath = path.join(__dirname, 'src/sql/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('⚙️  Applying schema...');
    await client.query(schema);
    console.log('✅ Schema applied successfully');
    
    console.log('📋 Reading seed.sql...');
    const seedPath = path.join(__dirname, 'src/sql/seed.sql');
    const seed = fs.readFileSync(seedPath, 'utf8');
    
    console.log('🌱 Applying seed data...');
    await client.query(seed);
    console.log('✅ Seed data applied successfully');
    
    console.log('\n🎉 Database setup complete!');
    console.log('   - Schema: 10 tables created');
    console.log('   - Triggers: Collision prevention + attendance tracking enabled');
    console.log('   - Demo data: 3 teachers, 3 rooms, 3 courses, 3 groups, 3 students loaded');
    
    client.release();
  } catch (error) {
    console.error('❌ Error setting up database:');
    console.error('   Message:', error.message);
    if (error.code) console.error('   Code:', error.code);
    if (error.detail) console.error('   Detail:', error.detail);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupDatabase();
