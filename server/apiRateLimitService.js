const globalRateLimitStateByKey = new Map()

const globalRateLimitPolicyByRoute = {
  auth: { windowMs: 10_000, maxRequests: 20 },
  write: { windowMs: 10_000, maxRequests: 60 },
  default: { windowMs: 10_000, maxRequests: 120 },
}

function resolveRateLimitPolicy(requestPathName, requestMethod) {
  if (requestPathName === '/api/admin/authenticate') {
    return globalRateLimitPolicyByRoute.auth
  }

  const isWriteMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(requestMethod || '').toUpperCase())
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

  const currentState = globalRateLimitStateByKey.get(rateLimitKey) || {
    requestCount: 0,
    windowStartMs: nowTimestamp,
  }

  const hasExpiredWindow = nowTimestamp - currentState.windowStartMs >= rateLimitPolicy.windowMs
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
