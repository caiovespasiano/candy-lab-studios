const globalRateLimitStateByKey = new Map()

const globalRateLimitPolicyByRoute = {
  auth: { windowMs: 60_000, maxRequests: 40 },
  contact: { windowMs: 60_000, maxRequests: 80 },
  write: { windowMs: 60_000, maxRequests: 240 },
  readCatalog: { windowMs: 60_000, maxRequests: 6_000 },
  default: { windowMs: 60_000, maxRequests: 600 },
}

function normalizeRateLimitState(currentState, nowTimestamp) {
  const safeRequestCount = Number.isFinite(currentState?.requestCount) && currentState.requestCount >= 0
    ? currentState.requestCount
    : 0
  const safeWindowStartMs = Number.isFinite(currentState?.windowStartMs)
    ? currentState.windowStartMs
    : nowTimestamp

  return {
    requestCount: safeRequestCount,
    windowStartMs: safeWindowStartMs,
  }
}

function resolveRateLimitPolicy(requestPathName, requestMethod) {
  if (requestPathName === '/api/admin/authenticate') {
    return globalRateLimitPolicyByRoute.auth
  }

  if (requestPathName === '/api/contact') {
    return globalRateLimitPolicyByRoute.contact
  }

  const normalizedRequestMethod = String(requestMethod || '').toUpperCase()

  if (normalizedRequestMethod === 'GET' && requestPathName === '/api/admin/articles') {
    return globalRateLimitPolicyByRoute.readCatalog
  }

  const isWriteMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(normalizedRequestMethod)
  if (isWriteMethod && requestPathName.startsWith('/api/admin/')) {
    return globalRateLimitPolicyByRoute.write
  }

  return globalRateLimitPolicyByRoute.default
}

function resolveRateLimitKey(clientIdentifier, requestPathName, requestMethod) {
  return `${clientIdentifier}|${String(requestMethod || 'GET').toUpperCase()}|${requestPathName}`
}

function pruneStaleRateLimitEntries(nowTimestamp) {
  globalRateLimitStateByKey.forEach((entryValue, entryKey) => {
    if (nowTimestamp - entryValue.windowStartMs > 60_000) {
      globalRateLimitStateByKey.delete(entryKey)
    }
  })
}

export function resolveApiRateLimitResult({ clientIdentifier, requestMethod, requestPathName, nowTimestampProvider = Date.now }) {
  const nowTimestamp = nowTimestampProvider()
  const rateLimitPolicy = resolveRateLimitPolicy(requestPathName, requestMethod)
  const rateLimitKey = resolveRateLimitKey(clientIdentifier, requestPathName, requestMethod)

  const currentState = normalizeRateLimitState(globalRateLimitStateByKey.get(rateLimitKey), nowTimestamp)

  const hasExpiredWindow = nowTimestamp < currentState.windowStartMs
    || nowTimestamp - currentState.windowStartMs >= rateLimitPolicy.windowMs
  const nextState = hasExpiredWindow
    ? { requestCount: 1, windowStartMs: nowTimestamp }
    : { requestCount: currentState.requestCount + 1, windowStartMs: currentState.windowStartMs }

  globalRateLimitStateByKey.set(rateLimitKey, nextState)

  if (globalRateLimitStateByKey.size > 5000) {
    pruneStaleRateLimitEntries(nowTimestamp)
  }

  if (nextState.requestCount <= rateLimitPolicy.maxRequests) {
    return {
      isRateLimited: false,
      remainingRequests: Math.max(0, rateLimitPolicy.maxRequests - nextState.requestCount),
    }
  }

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((rateLimitPolicy.windowMs - (nowTimestamp - nextState.windowStartMs)) / 1000)
  )

  return {
    isRateLimited: true,
    retryAfterSeconds,
  }
}
