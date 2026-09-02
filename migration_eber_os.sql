-- 1. Mise à jour de la table des dépenses
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS quantite numeric DEFAULT 1,
ADD COLUMN IF NOT EXISTS prix_unitaire numeric;

-- 2. Création de la table des documents (GED)
CREATE TABLE IF NOT EXISTS documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id text, -- Peut contenir 'GLOBAL' pour la GED Entreprise, ou l'UUID du projet
  name text NOT NULL,
  file_name text NOT NULL,
  url text NOT NULL,
  type text,
  created_at timestamp with time zone DEFAULT now()
);

-- 3. Création de la table du planning (Tasks)
CREATE TABLE IF NOT EXISTS tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date,
  end_date date,
  progress integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- 4. Sécurité (Permettre aux utilisateurs connectés de lire/écrire)
-- Sur Supabase, si tu utilises l'authentification (ce qu'on a mis en place), il faut activer ces règles.
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for authenticated users on documents" ON documents FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Enable all operations for authenticated users on tasks" ON tasks FOR ALL USING (auth.uid() IS NOT NULL);
