import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Utilisation de la variable d'environnement pour la sécurité, ou par défaut la chaîne fournie.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required. Copy .env.example to .env and configure it.");
}

async function runMigrations() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("✅ Connecté à la base de données Supabase.");

    const sqlPath = path.join(__dirname, 'migration_v3.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log("⏳ Exécution de la migration en cours...");
    await client.query(sql);

    // Reload schema cache for PostgREST
    await client.query("NOTIFY pgrst, 'reload schema';");

    console.log("✅ Migration exécutée avec succès ! La colonne date_commencement est prête et le cache est rechargé.");
  } catch (err) {
    console.error("❌ Erreur lors de l'exécution :", err.message);
  } finally {
    await client.end();
  }
}

runMigrations();