CREATE POLICY "No direct app config access"
ON public.app_config
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);