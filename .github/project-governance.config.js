/**
 * Central project governance for Dimi 3D Dev.
 * This file is the single source of truth for architecture, coding, security and testing rules.
 */

const projectGovernanceConfig = {
  projectIdentity: {
    projectName: 'Dimi3DDev',
    projectType: 'websiteCloneWithAdminPanel',
    defaultLanguage: 'JavaScript',
    frontendStack: ['React', 'TailwindCSS'],
    backendRuntime: 'NodeOrNextApiRoutes',
  },
  mandatoryExecutionRule: {
    ruleId: 'alwaysReadGovernanceBeforeImplementation',
    description:
      'Before implementing any new request, read this configuration and enforce all mandatory conventions.',
    appliesTo: ['allPrompts', 'allIterations', 'allGeneratedCode'],
  },
  codeStyleAndArchitecture: {
    enforceSolidPrinciples: true,
    enforceCleanCodePrinciples: true,
    maxCharactersPerLine: 140,
    maxCharactersPerLineExceptions: ['builderPattern'],
    namingConvention: {
      required: 'camelCase',
      forbidden: ['snake_case'],
      requireHighlyDescriptiveVariableNames: true,
      requireHighlyDescriptiveFunctionNames: true,
    },
    reusePolicy: {
      extractReusableLogicToPrivateFunctions: true,
      allowStaticPrivateHelpers: true,
      promoteHighLevelStateForSharedValues: true,
      avoidRepeatedAllocationForSharedStructures: true,
    },
    persistencePolicy: {
      requireProjectLevelPersistenceForStateChanges: true,
      forbidBrowserOnlyPersistenceForMutations: true,
      requiredMutationCategories: ['create', 'update', 'delete', 'upload', 'preferences'],
    },
  },
  presentationAndSeo: {
    requireSemanticHtml: true,
    requiredSemanticTags: ['header', 'main', 'section', 'article', 'footer', 'span', 'div'],
    requireSeoFriendlyStructure: true,
    requireAccessibilityCompliance: true,
  },
  securityBaseline2026: {
    preventXssInAllInputFields: true,
    sanitizeAllIncomingData: true,
    validateInputClientAndServer: true,
    encodeOutputByContext: true,
    requireStrictContentSecurityPolicy: true,
    requireSecurityHeaders: [
      'Content-Security-Policy',
      'X-Content-Type-Options',
      'Referrer-Policy',
      'Strict-Transport-Security',
      'Permissions-Policy',
    ],
  },
  errorHandlingAndHttpMapping: {
    requireCentralizedExceptionLayer: true,
    mapAllHttpStatusCodes: true,
    forbidSensitiveServerDetailsInClientResponses: true,
    requireSanitizedClientErrorPayload: true,
    includeCorrelationIdForSafeTraceability: true,
  },
  testingPolicy: {
    requireUnitTestPerMethodOrFunction: true,
    unitTesting: {
      requireMocksForDependencies: true,
      forbidMockingSubjectUnderTest: true,
    },
    integrationTesting: {
      requireCompleteEndToEndFlowCoverage: true,
      executeOnlyAtFinalProjectStage: true,
      forbidInternalMocks: true,
      allowExternalApiMockOnly: true,
    },
    testNaming: {
      requiredPattern: 'whenThen',
      requiredConvention: 'camelCase',
      forbiddenConvention: 'snake_case',
    },
  },
}

export default projectGovernanceConfig
