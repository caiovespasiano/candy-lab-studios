export async function persistAdminSessionToken() {
  return { isPersisted: true }
}

export async function clearPersistedAdminSessionToken() {
  if (typeof fetch !== 'function') {
    return
  }

  await fetch('/api/admin/logout', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  }).catch(() => undefined)
}

export async function restoreValidAdminSessionData() {
  if (typeof fetch !== 'function') {
    return { isAuthenticated: false }
  }

  try {
    const sessionResponse = await fetch('/api/admin/session', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    })

    if (!sessionResponse.ok) {
      return { isAuthenticated: false }
    }

    const sessionPayload = await sessionResponse.json().catch(() => ({}))

    if (!sessionPayload.username || !sessionPayload.sessionExpiresAtInSeconds) {
      return { isAuthenticated: false }
    }

    return {
      isAuthenticated: true,
      sessionData: {
        username: String(sessionPayload.username),
        expiresAtInSeconds: Number(sessionPayload.sessionExpiresAtInSeconds),
      },
    }
  } catch {
    return { isAuthenticated: false }
  }
}
