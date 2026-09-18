import { useFormikContext } from 'formik';
import type { ReactNode } from 'react';
import { Button } from '../ui/Button';

type Props = {
  children: ReactNode;
  fullWidth?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
};

/**
 * Form submit control. Always goes through shared Button → shared Spinner.
 */
export function FormSubmitButton({
  children,
  fullWidth,
  variant = 'primary',
  size = 'md',
}: Props) {
  const { isSubmitting } = useFormikContext();

  return (
    <Button type="submit" variant={variant} size={size} fullWidth={fullWidth} loading={isSubmitting}>
      {children}
    </Button>
  );
}
