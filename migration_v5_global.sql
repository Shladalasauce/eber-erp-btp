CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Gestion Globale du Personnel (RH)
CREATE TABLE IF NOT EXISTS personnel (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    matricule text,
    nom text NOT NULL,
    prenom text NOT NULL,
    type_contrat text CHECK (type_contrat IN ('CDI', 'CDD', 'INTERIM', 'SOUS_TRAITANT')),
    role text,
    cout_horaire_moyen numeric DEFAULT 0,
    statut text CHECK (statut IN ('ACTIF', 'CONGE', 'INACTIF')) DEFAULT 'ACTIF',
    date_embauche date,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE personnel ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all operations for authenticated users on personnel" ON personnel FOR ALL USING (auth.uid() IS NOT NULL);

-- 2. Liaison du personnel avec les pointages (labor_logs)
ALTER TABLE labor_logs
ADD COLUMN IF NOT EXISTS personnel_id UUID REFERENCES personnel(id) ON DELETE SET NULL;
