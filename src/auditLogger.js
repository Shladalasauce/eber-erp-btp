import { supabase } from './supabaseClient';

export async function logSystemEvent(projectId, action, tableName, recordId, details) {
  try {
    const { error } = await supabase.from('system_events').insert([{
      project_id: projectId,
      action: action,
      table_name: tableName,
      record_id: recordId,
      details: details,
      // created_at is handled by DB typically, but let's pass a JS timestamp just in case
      created_at: new Date().toISOString()
    }]);
    if (error) {
      console.warn("Audit Log Warning: Ensure 'system_events' table exists with appropriate schema.", error.message);
    }
  } catch (err) {
    console.error("Audit Log Failure:", err);
  }
}
