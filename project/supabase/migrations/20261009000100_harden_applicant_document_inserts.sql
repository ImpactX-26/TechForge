DROP POLICY IF EXISTS "applicant_documents_insert_owner" ON public.applicant_documents;
CREATE POLICY "applicant_documents_insert_owner"
  ON public.applicant_documents FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND storage_path = (auth.uid()::text || '/' || id::text)
    AND ai_analysis IS NULL
  );
