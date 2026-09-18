import { Formik, Form as FormikForm, type FormikConfig, type FormikValues } from 'formik';
import type { ReactNode } from 'react';
import clsx from 'clsx';

type AppFormProps<T extends FormikValues> = FormikConfig<T> & {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
};

export function AppForm<T extends FormikValues>({
  children,
  className,
  title,
  description,
  ...formikProps
}: AppFormProps<T>) {
  return (
    <Formik {...formikProps}>
      <FormikForm className={clsx('grid gap-4', className)}>
        {(title || description) && (
          <div>
            {title ? <h2 className="mb-1 text-xl font-bold tracking-tight">{title}</h2> : null}
            {description ? <p className="text-sm text-ink-soft">{description}</p> : null}
          </div>
        )}
        {children}
      </FormikForm>
    </Formik>
  );
}
