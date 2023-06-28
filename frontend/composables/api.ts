import type { FetchOptions } from 'ofetch'

export function $api<R>(path: string, options = {} as FetchOptions): Promise<R> {
  const config = useRuntimeConfig()

  options.baseURL = config.public.apiURL
  options.credentials = 'include'
  return $fetch(path, options as any)
}
