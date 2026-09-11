import { lazy, type ComponentType, type ReactNode, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-[40vh] flex-col gap-3 p-4" aria-busy="true" aria-label="页面加载中">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export function lazyRoute<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
): ComponentType<React.ComponentProps<T>> {
  const Lazy = lazy(factory);
  return function LazyRoute(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <Lazy {...props} />
      </Suspense>
    );
  };
}

export function withRouteSuspense(children: ReactNode) {
  return <Suspense fallback={<RouteLoadingFallback />}>{children}</Suspense>;
}
