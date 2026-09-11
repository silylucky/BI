/** 限制异步任务并发数，超出部分排队等待 */
export function createConcurrencyLimiter(maxConcurrent: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const pump = () => {
    while (active < maxConcurrent && queue.length > 0) {
      active += 1;
      const next = queue.shift()!;
      next();
    }
  };

  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        fn().then(resolve, reject).finally(() => {
          active -= 1;
          pump();
        });
      };
      if (active < maxConcurrent) {
        active += 1;
        run();
      } else {
        queue.push(run);
      }
    });
  };
}
