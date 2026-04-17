const globalPublicMessageByHttpStatusCode = {
  400: 'A solicitação está inválida. Revise os dados enviados.',
  401: 'Sua sessão não foi autorizada. Realize a autenticação novamente.',
  403: 'Você não possui permissão para executar esta operação.',
  404: 'O recurso solicitado não foi encontrado.',
  409: 'Conflito de estado detectado. Tente novamente em instantes.',
  422: 'Os dados enviados não atenderam aos critérios de validação.',
  429: 'Limite de requisições atingido. Aguarde e tente novamente.',
  500: 'Não foi possível concluir sua solicitação no momento.',
  503: 'Serviço temporariamente indisponível. Tente novamente mais tarde.',
}

export function mapHttpStatusToSanitizedErrorResponse(httpStatusCode, correlationIdentifier) {
  const normalizedHttpStatusCode = Number(httpStatusCode)
  const safeHttpStatusCode = Number.isInteger(normalizedHttpStatusCode) ? normalizedHttpStatusCode : 500
  const fallbackCorrelationIdentifier = correlationIdentifier || 'correlation-id-not-provided'

  return {
    statusCode: safeHttpStatusCode,
    publicMessage:
      globalPublicMessageByHttpStatusCode[safeHttpStatusCode] ??
      'Erro inesperado durante o processamento da solicitação.',
    correlationIdentifier: fallbackCorrelationIdentifier,
  }
}
