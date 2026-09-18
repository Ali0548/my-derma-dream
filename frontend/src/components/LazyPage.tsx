import { Suspense, type ComponentType, lazy } from 'react';
import { ComponentLoader } from './ui/ComponentLoader';

export function lazyPage(
  factory: () => Promise<{ default: ComponentType }>,
  label = 'Loading page',
) {
  const LazyComponent = lazy(factory);

  return function LazyPageWrapper() {
    return (
      <Suspense
        fallback={
          <div className="p-2 sm:p-4">
            <ComponentLoader label={label} rows={5} />
          </div>
        }
      >
        <LazyComponent />
      </Suspense>
    );
  };
}
