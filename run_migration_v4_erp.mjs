import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required. Copy .env.example to .env and configure it.");
}

async function runMigrations() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();
    console.log("✅ Connecté à la base de données Supabase.");

    const sqlPath = path.join(__dirname, 'migration_v4_erp.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log("⏳ Exécution de la migration V4 (ERP) en cours...");
    await client.query(sql);

    await client.query("NOTIFY pgrst, 'reload schema';");

    console.log("✅ Migration V4 exécutée avec succès !");
  } catch (err) {
    console.error("❌ Erreur lors de l'exécution :", err.message);
  } finally {
    await client.end();
  }
}

runMigrations();