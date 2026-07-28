import type { PostgrestError } from '@supabase/supabase-js'

type Result<T> = { data: T; error: PostgrestError | null }

/**
 * A stand-in for a PostgREST query builder.
 *
 * The real builder returns itself from every filter so calls can chain in any
 * order, and only resolves when awaited. Hand-rolled mocks that spell out one
 * exact chain (`select().eq().in()`) encode the current call order as if it
 * were the contract, so adding a filter breaks every test that touched the
 * query even when the behaviour under test is unchanged.
 *
 * This proxy accepts any chain and records it, so tests can assert on the
 * filters they care about and stay silent about the rest.
 */
export type QueryBuilderMock<T> = PromiseLike<Result<T>> & {
  /** Every chained call, in order, as [method, ...args]. */
  calls: Array<[string, ...Array<unknown>]>
  /** Args of the first call to `method`, or undefined if it was never called. */
  argsFor: (method: string) => Array<unknown> | undefined
}

export function mockQueryBuilder<T>(
  data: T,
  error: PostgrestError | null = null,
): QueryBuilderMock<T> {
  const calls: Array<[string, ...Array<unknown>]> = []
  const result: Result<T> = { data, error }

  const target = {
    calls,
    argsFor(method: string) {
      return calls.find(([name]) => name === method)?.slice(1)
    },
    then<TResult>(
      onFulfilled?: (value: Result<T>) => TResult | PromiseLike<TResult>,
    ) {
      return Promise.resolve(result).then(onFulfilled)
    },
  }

  // The proxy answers any filter name, which no static type can express; the
  // declared return type is the contract callers actually see.
  const proxy: QueryBuilderMock<T> = new Proxy(target, {
    get(obj, prop, receiver) {
      if (prop in obj) return Reflect.get(obj, prop, receiver)
      if (typeof prop !== 'string') return undefined
      // Any unknown property is treated as a filter: record it and keep the
      // chain going.
      return (...args: Array<unknown>) => {
        calls.push([prop, ...args])
        return receiver
      }
    },
  })

  return proxy
}
