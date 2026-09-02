-- 1. Mise à jour de la table projects (Identifiants et Délais)
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS appel_offre_num text,
ADD COLUMN IF NOT EXISTS marche_num text,
ADD COLUMN IF NOT EXISTS delai_execution_jours integer;

-- 2. Création de la table des Arrêts et Reprises
CREATE TABLE IF NOT EXISTS arrets_reprises (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  type text CHECK (type IN ('ARRET', 'REPRISE')),
  date_event date NOT NULL,
  motif text,
  document_url text, -- Lien vers l'Ordre de Service d'arrêt/reprise
  created_at timestamp with time zone DEFAULT now()
);

-- 3. Sécurité pour la nouvelle table
ALTER TABLE arrets_reprises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all operations for authenticated users on arrets_reprises" ON arrets_reprises FOR ALL USING (auth.uid() IS NOT NULL);
