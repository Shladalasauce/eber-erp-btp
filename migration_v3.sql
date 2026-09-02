-- 1. Ajout de la date de commencement pour initialiser le planning IA et le Gantt
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS date_commencement date;