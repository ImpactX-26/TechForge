ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'accepted', 'rejected')),
  ADD COLUMN IF NOT EXISTS review_note text;

CREATE TABLE IF NOT EXISTS public.applicant_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('english_test', 'ielts', 'degree', 'other')),
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  file_size bigint NOT NULL CHECK (file_size BETWEEN 1 AND 10485760),
  ai_analysis jsonb,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.applicant_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applicant_documents_select_owner_or_admin" ON public.applicant_documents;
CREATE POLICY "applicant_documents_select_owner_or_admin"
  ON public.applicant_documents FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "applicant_documents_insert_owner" ON public.applicant_documents;
CREATE POLICY "applicant_documents_insert_owner"
  ON public.applicant_documents FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "applicant_documents_update_admin" ON public.applicant_documents;
CREATE POLICY "applicant_documents_update_admin"
  ON public.applicant_documents FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE ALL ON public.applicant_documents FROM anon;
GRANT SELECT, INSERT ON public.applicant_documents TO authenticated;
GRANT UPDATE ON public.applicant_documents TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_application_review_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.review_status := 'pending';
      NEW.review_note := NULL;
    ELSE
      IF NEW.review_status IS DISTINCT FROM OLD.review_status
         AND NEW.review_status <> 'pending' THEN
        RAISE EXCEPTION 'Only an authorised reviewer can accept or reject an application.';
      END IF;
      IF NEW.review_note IS DISTINCT FROM OLD.review_note
         AND NEW.review_note IS NOT NULL THEN
        RAISE EXCEPTION 'Only an authorised reviewer can add a review note.';
      END IF;
      IF OLD.review_status <> 'pending'
         AND (NEW.name IS DISTINCT FROM OLD.name
           OR NEW.goal IS DISTINCT FROM OLD.goal
           OR NEW.city IS DISTINCT FROM OLD.city
           OR NEW.focus IS DISTINCT FROM OLD.focus
           OR NEW.profile_data IS DISTINCT FROM OLD.profile_data
           OR NEW.video_path IS DISTINCT FROM OLD.video_path) THEN
        NEW.review_status := 'pending';
        NEW.review_note := NULL;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_application_review_decision() FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS protect_application_review_decision ON public.applications;
CREATE TRIGGER protect_application_review_decision
  BEFORE INSERT OR UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.protect_application_review_decision();

CREATE OR REPLACE FUNCTION public.handle_applicant_document_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.applications
    SET review_status = 'pending',
        review_note = NULL,
        status = 'Documents updated',
        profile_data = profile_data - 'cvDraft',
        updated_at = now()
    WHERE user_id = NEW.user_id;
  ELSE
    UPDATE public.applications
    SET profile_data = profile_data - 'cvDraft',
        updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_applicant_document_change() FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS reset_review_after_document_upload ON public.applicant_documents;
CREATE TRIGGER reset_review_after_document_upload
  AFTER INSERT ON public.applicant_documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_applicant_document_change();

DROP TRIGGER IF EXISTS clear_cv_after_document_analysis ON public.applicant_documents;
CREATE TRIGGER clear_cv_after_document_analysis
  AFTER UPDATE OF ai_analysis ON public.applicant_documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_applicant_document_change();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'private-applicant-documents',
  'private-applicant-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'];

DROP POLICY IF EXISTS "documents_storage_select_owner_or_admin" ON storage.objects;
CREATE POLICY "documents_storage_select_owner_or_admin"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'private-applicant-documents'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

DROP POLICY IF EXISTS "documents_storage_insert_owner" ON storage.objects;
CREATE POLICY "documents_storage_insert_owner"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'private-applicant-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "documents_storage_delete_owner" ON storage.objects;
CREATE POLICY "documents_storage_delete_owner"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'private-applicant-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

GRANT SELECT ON public.applicant_documents TO authenticated;
