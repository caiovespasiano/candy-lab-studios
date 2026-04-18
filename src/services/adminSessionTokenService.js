import { globalAdminAccessConfig } from '../constants/globalAdminAccessConfig'

const globalTokenHeader = {
  alg: 'HS256',
  typ: 'JWT',
}

const globalFallbackSecret = 'local-admin-signature-secret-2026'

function convertTextToBase64Url(textValue) {
  const utf8Bytes = new TextEncoder().encode(textValue)
  const binaryString = Array.from(utf8Bytes, (byte) => String.fromCharCode(byte)).join('')
  const base64Value = btoa(binaryString)
  return base64Value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function convertBase64UrlToText(base64UrlValue) {
  const normalizedBase64Value = base64UrlValue.replace(/-/g, '+').replace(/_/g, '/')
  const paddedBase64Value = `${normalizedBase64Value}${'='.repeat((4 - (normalizedBase64Value.length % 4)) % 4)}`
  const binaryString = atob(paddedBase64Value)
  const utf8Bytes = Uint8Array.from(binaryString, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(utf8Bytes)
}

async function createHmacSha256Signature(unsignedToken, secret) {
  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: { name: 'SHA-256' } },
    false,
    ['sign']
  )
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(unsignedToken))
  const signatureBytes = new Uint8Array(signatureBuffer)
  const binaryString = Array.from(signatureBytes, (byte) => String.fromCharCode(byte)).join('')
  return btoa(binaryString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function verifyHmacSha256Signature(unsignedToken, secret, expectedSignature) {
  const recomputed = await createHmacSha256Signature(unsignedToken, secret)
  return recomputed === expectedSignature
}

function resolveSessionSecretFromEnvironment() {
  const environmentSecret = import.meta.env.VITE_ADMIN_SESSION_SECRET
  return environmentSecret || globalFallbackSecret
}

export async function createAdminSessionToken(adminIdentityData, nowTimestampProvider = Date.now) {
  const issuedAtInSeconds = Math.floor(nowTimestampProvider() / 1000)
  const expiresInSeconds = globalAdminAccessConfig.adminSessionDurationInMinutes * 60
  const expirationInSeconds = issuedAtInSeconds + expiresInSeconds
  const safeAdminName = String(adminIdentityData.username || '').trim()
  const tokenPayload = {
    sub: safeAdminName,
    scope: 'admin',
    iat: issuedAtInSeconds,
    exp: expirationInSeconds,
  }
  const encodedHeader = convertTextToBase64Url(JSON.stringify(globalTokenHeader))
  const encodedPayload = convertTextToBase64Url(JSON.stringify(tokenPayload))
  const unsignedTokenValue = `${encodedHeader}.${encodedPayload}`
  const tokenSignature = await createHmacSha256Signature(unsignedTokenValue, resolveSessionSecretFromEnvironment())

  return `${unsignedTokenValue}.${tokenSignature}`
}

export async function parseAndValidateAdminSessionToken(rawSessionToken, nowTimestampProvider = Date.now) {
  try {
    const tokenParts = String(rawSessionToken || '').split('.')

    if (tokenParts.length !== 3) {
      return { isValid: false, reason: 'token-malformado' }
    }

    const [encodedHeader, encodedPayload, signatureValue] = tokenParts
    const unsignedTokenValue = `${encodedHeader}.${encodedPayload}`
    const isSignatureValid = await verifyHmacSha256Signature(
      unsignedTokenValue,
      resolveSessionSecretFromEnvironment(),
      signatureValue
    )

    if (!isSignatureValid) {
      return { isValid: false, reason: 'assinatura-invalida' }
    }

    const payloadTextValue = convertBase64UrlToText(encodedPayload)
    const payloadObject = JSON.parse(payloadTextValue)
    const currentTimestampInSeconds = Math.floor(nowTimestampProvider() / 1000)

    if (typeof payloadObject.exp !== 'number' || payloadObject.exp <= currentTimestampInSeconds) {
      return { isValid: false, reason: 'token-expirado' }
    }

    if (payloadObject.scope !== 'admin') {
      return { isValid: false, reason: 'escopo-invalido' }
    }

    return {
      isValid: true,
      sessionData: {
        username: payloadObject.sub,
        expiresAtInSeconds: payloadObject.exp,
      },
    }
  } catch (unknownError) {
    return { isValid: false, reason: 'falha-decodificacao' }
  }
}