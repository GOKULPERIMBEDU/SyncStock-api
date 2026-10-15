/**
 * The yard simulation and the ledger hooks both mutate the same docks, trucks and racks. A single in-process queue
 * serialises them so a stock transaction can never interleave with a simulation tick. (One API process, one queue.)
 */
let tail: Promise<unknown> = Promise.resolve();

export function withYardLock<T>(task: () => Promise<T>): Promise<T> {
  const run = tail.then(() => task());
  tail = run.catch(() => undefined);
  return run;
}
