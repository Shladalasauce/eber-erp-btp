CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Gestion des Utilisateurs et Rôles (RBAC)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    role text CHECK (role IN ('ADMIN', 'COMPTABLE', 'CHEF_PROJET', 'OUVRIER')) DEFAULT 'OUVRIER',
    first_name text,
    last_name text,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read operations for authenticated users on user_profiles" ON user_profiles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Enable update for users on their own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Trésorerie, Facturation
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    type text CHECK (type IN ('CLIENT', 'FOURNISSEUR')),
    status text CHECK (status IN ('BROUILLON', 'EMISE', 'EN_ATTENTE', 'PAYEE', 'EN_RETARD')) DEFAULT 'BROUILLON',
    reference text,
    fournisseur_nom text,
    date_emission date,
    date_echeance date,
    montant_ht numeric DEFAULT 0,
    tva numeric DEFAULT 0,
    montant_ttc numeric DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all operations for authenticated users on invoices" ON invoices FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS invoice_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    designation text NOT NULL,
    quantite numeric DEFAULT 1,
    prix_unitaire numeric NOT NULL,
    tva_taux numeric DEFAULT 20,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all operations for authenticated users on invoice_lines" ON invoice_lines FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    montant numeric NOT NULL,
    date_paiement date NOT NULL,
    moyen_paiement text,
    reference_bancaire text,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all operations for authenticated users on payments" ON payments FOR ALL USING (auth.uid() IS NOT NULL);

-- 3. Historisation, Traçabilité (Audit Trail)
CREATE TABLE IF NOT EXISTS system_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID,
    action text NOT NULL,
    table_name text NOT NULL,
    record_id UUID,
    details jsonb,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE system_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all operations for authenticated users on system_events" ON system_events FOR ALL USING (auth.uid() IS NOT NULL);

-- 4. Modifs sur Expenses (Workflows de validation)
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS status text CHECK (status IN ('BROUILLON', 'EN_ATTENTE', 'APPROUVEE', 'REJETEE')) DEFAULT 'APPROUVEE',
ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;

-- 5. BPU Versioning & Avenants
CREATE TABLE IF NOT EXISTS bpu_avenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    titre text NOT NULL,
    description text,
    date_validation date,
    montant_total numeric,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE bpu_avenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all operations for authenticated users on bpu_avenants" ON bpu_avenants FOR ALL USING (auth.uid() IS NOT NULL);

ALTER TABLE bpu_lines
ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_avenant boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS avenant_id UUID REFERENCES bpu_avenants(id) ON DELETE CASCADE;
