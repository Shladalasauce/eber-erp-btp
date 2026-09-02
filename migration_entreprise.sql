-- ÉTAPE 2: Logistique (BC et BL)
ALTER TABLE procurement_orders ADD COLUMN IF NOT EXISTS bc_pdf_url text;
ALTER TABLE procurement_orders ADD COLUMN IF NOT EXISTS bl_number text;
ALTER TABLE procurement_orders ADD COLUMN IF NOT EXISTS bl_photo_url text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bc_id uuid REFERENCES procurement_orders(id);

-- ÉTAPE 3: Déboursé sec (Contrôle de gestion)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS bpu_line_id uuid REFERENCES bpu_lines(id) ON DELETE SET NULL;

-- ÉTAPE 4: Parc Engins et Matériel
CREATE TABLE IF NOT EXISTS equipment (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  plate_number text,
  daily_cost numeric DEFAULT 0,
  current_project_id uuid REFERENCES projects(id),
  status text DEFAULT 'ACTIF',
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS equipment_id uuid REFERENCES equipment(id) ON DELETE SET NULL;

-- ÉTAPE 5: RH Avancée (Heures sup, Pluie, Avances)
ALTER TABLE labor_logs ADD COLUMN IF NOT EXISTS hour_type text DEFAULT 'NORMALE' CHECK (hour_type IN ('NORMALE', 'SUP', 'PLUIE'));
ALTER TABLE labor_logs ADD COLUMN IF NOT EXISTS is_advance boolean DEFAULT false;

-- ÉTAPE 6: Profils Utilisateurs (RBAC)
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  role text DEFAULT 'CHEF_CHANTIER' CHECK (role IN ('ADMIN', 'CHEF_CHANTIER', 'ACHETEUR'))
);

-- Activer la RLS
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all operations for auth users on equipment" ON equipment FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Enable all operations for auth users on profiles" ON user_profiles FOR ALL USING (auth.uid() IS NOT NULL);