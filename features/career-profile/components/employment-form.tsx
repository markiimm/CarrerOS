'use client';

import { Lock, Trash2 } from 'lucide-react';
import { ActionForm, ConfirmAction } from '@/components/form/action-form';
import { FieldRow, NumberField, SelectField, TextareaField, TextField } from '@/components/form/fields';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { t } from '@/lib/i18n/pt-BR';
import { deleteCurrentEmployment, saveCurrentEmployment } from '../actions';
import type { CurrentEmploymentView } from '../queries';
import { BENEFIT_KEYS, currentEmploymentSchema } from '../schemas';
import { toOptions } from './overview';

const num = (v: number | null | undefined) => (v == null ? '' : String(v).replace('.', ','));

export function CurrentEmploymentCard({ employment }: { employment: CurrentEmploymentView | null }) {
  const e = t.profile.employment;
  return (
    <Card>
      <CardHeader title={e.title} description={e.description} />
      <CardContent className="grid gap-4">
        <p className="flex items-start gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-13 text-muted-foreground">
          <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {e.sensitive}
        </p>
        {/* A chave recria o formulário quando o registro é excluído, limpando os campos. */}
        <ActionForm
          key={employment?.updated_at ?? 'new'}
          schema={currentEmploymentSchema}
          action={saveCurrentEmployment}
          footer={employment ? (
            <ConfirmAction
              title={e.deleteTitle}
              body={e.deleteBody}
              action={deleteCurrentEmployment}
              trigger={<Button variant="ghost"><Trash2 />{t.common.remove}</Button>}
            />
          ) : null}
        >
          <FieldRow>
            <TextField name="company_name" label={e.company} defaultValue={employment?.company_name ?? ''} required />
            <TextField name="role_title" label={e.role} defaultValue={employment?.role_title ?? ''} required />
          </FieldRow>
          <FieldRow className="sm:grid-cols-3">
            <TextField name="started_at" label={e.startedAt} type="date" defaultValue={employment?.started_at ?? ''} optional />
            <SelectField name="contract_type" label={e.contractType} options={toOptions(t.enums.contractType)} defaultValue={employment?.contract_type ?? 'clt'} placeholder={null} required />
            <SelectField name="work_model" label={e.workModel} options={toOptions(t.enums.workModel)} defaultValue={employment?.work_model ?? ''} optional />
          </FieldRow>
          <FieldRow>
            <NumberField name="base_salary" label={e.baseSalary} defaultValue={num(employment?.base_salary)} optional />
            <NumberField name="bonus_annual" label={e.bonus} defaultValue={num(employment?.bonus_annual)} optional />
          </FieldRow>
          <fieldset className="grid gap-3">
            <legend className="mb-2 text-13 font-medium">{e.benefitsTitle}</legend>
            <FieldRow className="sm:grid-cols-3">
              {BENEFIT_KEYS.map((key) => (
                <NumberField key={key} name={`benefit_${key}`} label={e.benefits[key]} defaultValue={num(employment?.benefits[key])} optional />
              ))}
            </FieldRow>
          </fieldset>
          <FieldRow className="sm:grid-cols-3">
            <NumberField name="commute_cost_monthly" label={e.commuteCost} defaultValue={num(employment?.commute_cost_monthly)} optional />
            <NumberField name="commute_minutes_daily" label={e.commuteMinutes} inputMode="numeric" defaultValue={num(employment?.commute_minutes_daily)} optional />
            <NumberField name="satisfaction" label={e.satisfaction} inputMode="numeric" defaultValue={num(employment?.satisfaction)} optional />
          </FieldRow>
          <TextareaField name="notes" label={e.notes} defaultValue={employment?.notes ?? ''} rows={3} optional />
        </ActionForm>
      </CardContent>
    </Card>
  );
}
