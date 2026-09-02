CREATE TABLE IF NOT EXISTS recurring_expenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  designation text NOT NULL,
  montant numeric DEFAULT 0,
  categorie text DEFAULT 'Frais Généraux',
  start_date date,
  end_date date,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all operations for auth users on recurring_expenses" ON recurring_expenses FOR ALL USING (auth.uid() IS NOT NULL);
