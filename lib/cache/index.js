const { NotCachedError } = require('./errors.js')
const CacheEntry = require('./entry.js')
const remote = require('../remote.js')

// do whatever is necessary to get a Response and return it
const cacheFetch = async (request, options) => {
  // try to find a cached entry that satisfies this request
  const entry = await CacheEntry.find(request, options)
  if (!entry) {
    // no cached result, if the cache mode is only-if-cached that's a failure
    if (options.cache === 'only-if-cached')
      throw new NotCachedError(request.url)

    // otherwise, we make a request, store it and return it
    const response = await remote(request, options)
    const entry = new CacheEntry({ request, response, options })
    return entry.store('miss')
  }

  // we have a cached response that satisfies this request, however
  // if the cache mode is reload the user explicitly wants us to revalidate
  if (options.cache === 'reload')
    return entry.revalidate(request, options)

  // if the cache mode is either force-cache or only-if-cached we will only
  // respond with a cached entry, even if it's stale. set the status to the
  // appropriate value based on whether revalidation is needed and respond
  // from the cache
  const _needsRevalidation = entry.policy.needsRevalidation(request)
  if (options.cache === 'force-cache' ||
      options.cache === 'only-if-cached' ||
      !_needsRevalidation)
    return entry.respond(request.method, options, _needsRevalidation ? 'stale' : 'hit')

  // cache entry might be stale, revalidate it and return a response
  return entry.revalidate(request, options)
}

cacheFetch.invalidate = async (request, options) => {
  if (!options.cachePath)
    return

  return CacheEntry.invalidate(request, options)
}

module.exports = cacheFetch
