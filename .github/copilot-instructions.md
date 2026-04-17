# Instruções Globais do Projeto Dimi 3D Dev

## Regra Mandatória Contínua
Antes de qualquer implementação, consulte obrigatoriamente o arquivo `.github/project-governance.config.js` e cumpra
integralmente todas as convenções definidas nele.

## Fonte de Verdade
1. Documento de requisitos: `docs/dimi3d-requirements-specification.md`.
2. Manifesto arquitetural: `docs/dimi3d-architecture-manifesto.md`.
3. Configuração centralizada: `.github/project-governance.config.js`.

## Regras Obrigatórias
1. Linguagem padrão: JavaScript.
2. SOLID e Clean Code obrigatórios.
3. camelCase obrigatório e snake_case proibido.
4. Máximo de 140 caracteres por linha, exceto Builder.
5. Reuso obrigatório em funções privadas ou estáticas.
6. Estado/contexto global para valores recursivos no fluxo.
7. Sanitização total de entrada e prevenção de XSS.
8. Mapeamento de HTTP com mensagens de erro sanitizadas.
9. Testes unitários por função e integração apenas na etapa final.
