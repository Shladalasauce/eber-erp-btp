CREATE TABLE IF NOT EXISTS bpu_progress_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bpu_line_id UUID REFERENCES bpu_lines(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    ancienne_qte numeric,
    nouvelle_qte numeric,
    commentaire text,
    date_saisie TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_name text NOT NULL,
    file_url text NOT NULL,
    entity_type text NOT NULL,
    entity_id UUID NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE bpu_progress_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for authenticated users on bpu_progress_history" ON bpu_progress_history FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Enable all operations for authenticated users on attachments" ON attachments FOR ALL USING (auth.uid() IS NOT NULL);
