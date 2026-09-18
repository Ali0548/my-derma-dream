import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import * as Yup from 'yup';
import { AppForm } from '../components/form/AppForm';
import { TextField } from '../components/form/FormField';
import { FormSubmitButton } from '../components/form/FormSubmitButton';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';

const schema = Yup.object({
  email: Yup.string().email('Enter a valid email').required('Email is required'),
  password: Yup.string().required('Password is required'),
});

export default function LoginPage() {
  const { login, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  if (!isLoading && user) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="bg-login-mesh grid min-h-screen place-items-center px-4 py-8 sm:px-6">
      <div className="relative w-full max-w-[440px] overflow-hidden rounded-3xl border border-line bg-white/95 p-6 shadow-panel sm:p-8">
        <div className="bg-lumora-gradient absolute inset-x-0 top-0 h-1 opacity-85" />

        <div className="mb-6 flex items-center gap-3.5">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-lumora-gradient text-xl font-extrabold text-white shadow-[0_12px_28px_rgba(26,168,184,0.28)]">
            L
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink">Lumora Labs</h1>
            <p className="mt-0.5 text-sm text-ink-soft">Sign in to the affiliate desk</p>
          </div>
        </div>

        <AppForm
          initialValues={{ email: '', password: '' }}
          validationSchema={schema}
          onSubmit={async (values) => {
            setFormError(null);
            try {
              await login(values.email, values.password);
              navigate('/app', { replace: true });
            } catch (error) {
              const message =
                error instanceof ApiError ? error.message : 'Unable to sign in';
              setFormError(message);
            }
          }}
        >
          <TextField name="email" label="Email" type="email" autoComplete="username" />
          <TextField
            name="password"
            label="Password"
            type="password"
            autoComplete="current-password"
          />

          {formError ? (
            <div className="rounded-xl bg-danger/10 px-3.5 py-3 text-sm font-semibold text-danger">
              {formError}
            </div>
          ) : null}

          <FormSubmitButton fullWidth>Sign in</FormSubmitButton>
        </AppForm>
      </div>
    </div>
  );
}
