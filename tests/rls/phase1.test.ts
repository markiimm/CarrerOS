import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Travessia A→B das tabelas pessoais da Fase 1 (RNF-TST-03) e criação das linhas padrão.
// Roda contra um banco com as migrations aplicadas; sem as três variáveis, é pulado.
// NUNCA aponte para produção: o teste cria e apaga dois usuários.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anonKey && serviceKey);

// Tabela → linha mínima válida (o user_id é preenchido pelo teste).
const PERSONAL_TABLES: Record<string, Record<string, unknown>> = {
  career_profiles: { name: 'Infra' },
  experiences: { company_name: 'ACME', role_title: 'Analista', start_date: '2023-01-01' },
  educations: { institution: 'FATEC' },
  certifications: { name: 'ITIL' },
  profile_links: { kind: 'github', url: 'https://github.com/exemplo' },
  current_employment: { company_name: 'ACME', role_title: 'Analista' },
};
const BOOTSTRAP_TABLES = ['profiles', 'user_settings', 'user_limits'];

describe.skipIf(!enabled)('RLS — Fase 1', () => {
  let admin: SupabaseClient;
  const users: Array<{ id: string; client: SupabaseClient }> = [];

  beforeAll(async () => {
    admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });
    for (const label of ['a', 'b']) {
      const email = `rls-${label}-${crypto.randomUUID()}@example.test`;
      const password = crypto.randomUUID();
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error) throw created.error;
      const client = createClient(url!, anonKey!, { auth: { persistSession: false } });
      const signedIn = await client.auth.signInWithPassword({ email, password });
      if (signedIn.error) throw signedIn.error;
      users.push({ id: created.data.user.id, client });
    }
  });

  afterAll(async () => {
    for (const user of users) await admin.auth.admin.deleteUser(user.id);
  });

  it('o cadastro cria as linhas padrão (RF-AUT-04)', async () => {
    const [a] = users;
    for (const table of BOOTSTRAP_TABLES) {
      const { data, error } = await a!.client.from(table).select('user_id');
      expect(error, table).toBeNull();
      expect(data, table).toEqual([{ user_id: a!.id }]);
    }
    const weights = await a!.client.from('offer_criteria_weights').select('criterion');
    expect(weights.data).toHaveLength(8);
  });

  it.each(BOOTSTRAP_TABLES)('%s: B não lê nem altera a linha de A', async (table) => {
    const [a, b] = users;
    const read = await b!.client.from(table).select('user_id').eq('user_id', a!.id);
    expect(read.data).toEqual([]);
    const update = await b!.client.from(table).update({ updated_at: new Date().toISOString() }).eq('user_id', a!.id).select('user_id');
    expect(update.data ?? []).toEqual([]);
  });

  it.each(Object.keys(PERSONAL_TABLES))('%s: B não lê, não altera, não apaga e não grava em nome de A', async (table) => {
    const [a, b] = users;
    const row = { ...PERSONAL_TABLES[table], user_id: a!.id };

    const inserted = await a!.client.from(table).insert(row).select('id').single();
    expect(inserted.error, 'A grava a própria linha').toBeNull();
    const id = inserted.data!.id as string;

    expect((await b!.client.from(table).select('id').eq('id', id)).data, 'B não lê').toEqual([]);
    expect((await b!.client.from(table).update({ updated_at: new Date().toISOString() }).eq('id', id).select('id')).data ?? [], 'B não altera').toEqual([]);
    expect((await b!.client.from(table).delete().eq('id', id).select('id')).data ?? [], 'B não apaga').toEqual([]);
    expect((await b!.client.from(table).insert(row)).error, 'B não grava com o user_id de A').not.toBeNull();

    expect((await a!.client.from(table).select('id').eq('id', id)).data, 'a linha de A continua lá').toHaveLength(1);
  });

  it('nenhuma tabela de public está sem RLS', async () => {
    // app_private não é exposto pela API; a mesma verificação é feita direto no catálogo.
    const anon = createClient(url!, anonKey!, { auth: { persistSession: false } });
    for (const table of [...BOOTSTRAP_TABLES, ...Object.keys(PERSONAL_TABLES)]) {
      const { data } = await anon.from(table).select('*').limit(1);
      expect(data ?? [], `${table} não devolve nada a anônimo`).toEqual([]);
    }
  });
});
