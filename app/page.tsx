import { redirect } from 'next/navigation';

// O middleware já decide entre /painel e /login; este é só o destino de segurança.
export default function RootPage() {
  redirect('/painel');
}
