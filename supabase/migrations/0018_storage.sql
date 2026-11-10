-- 0018 — Buckets privados e políticas de Storage
-- CareerOS · documento 16 §5 · RNF-SEC-05, RF-BIB-02
-- Convenção de caminho: {user_id}/{kind}/{uuid}.{ext}
-- A primeira pasta do caminho É o id do usuário: é nisso que a política se baseia.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents', 'documents', false, 10485760,
   array['application/pdf',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'image/png','image/jpeg']),
  ('avatars', 'avatars', false, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- documents: leitura, escrita e exclusão restritas à própria pasta.
drop policy if exists "documents_select_own" on storage.objects;
create policy "documents_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "documents_insert_own" on storage.objects;
create policy "documents_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "documents_update_own" on storage.objects;
create policy "documents_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "documents_delete_own" on storage.objects;
create policy "documents_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- avatars: mesmo padrão. Bucket privado; exibição por URL assinada.
drop policy if exists "avatars_all_own" on storage.objects;
create policy "avatars_all_own" on storage.objects
  for all to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Nenhuma política para anon: bucket privado é privado (RNF-SEC-05).
-- O acesso ao arquivo se dá por URL assinada com validade <= 5 minutos, gerada no servidor
-- apenas quando o usuário pede o arquivo.
