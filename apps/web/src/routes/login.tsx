import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useLogin } from '../hooks/queries';
import { isApiError } from '../api';
import { M } from '../messages';

/** S-00 */
export const Route = createFileRoute('/login')({
  validateSearch: (s: Record<string, unknown>) => ({ returnTo: typeof s.returnTo === 'string' ? s.returnTo : undefined, expired: s.expired === '1' || s.expired === true ? '1' : undefined }),
  component: Login,
});

function Login() {
  const { returnTo, expired } = Route.useSearch();
  const navigate = useNavigate();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <main className="mx-auto mt-24 w-80 border border-line bg-white p-6">
      <h1 className="mb-4 text-lg tracking-widest">{M.product}</h1>
      {expired && <p className="mb-3 border border-warn bg-warn-bg p-2 text-sm text-warn">⚠ {M.login.expired}</p>}
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          login.mutate({ email, password }, { onSuccess: () => void navigate({ to: returnTo && returnTo.startsWith('/') ? returnTo : '/' }) });
        }}
      >
        <label className="block text-sm">
          {M.login.email}
          <input className="field mt-1" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="block text-sm">
          {M.login.password}
          <input className="field mt-1" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {login.isError && (
          <p role="alert" className="text-sm text-block">
            {isApiError(login.error) && login.error.status === 401 ? M.login.bad : isApiError(login.error) ? login.error.problem.title : String(login.error)}
          </p>
        )}
        <button className="btn-primary w-full justify-center" type="submit" disabled={login.isPending}>
          {M.login.submit}
        </button>
      </form>
    </main>
  );
}
