# Manifesto Arquitetural

## Engenharia
1. Alta coesão e baixo acoplamento como padrão.
2. Lógica reutilizável deve ser extraída para funções privadas ou helpers estáticos.
3. Convenções de nome devem ser descritivas e orientadas ao domínio.

## Interface
1. HTML semântico obrigatório com header, main, section, article e footer.
2. Estrutura alinhada a SEO e acessibilidade desde a primeira iteração.

## Segurança
1. Toda entrada deve ser tratada como não confiável.
2. Sanitizar, validar e codificar saída por contexto.
3. Camada centralizada de exceções com mensagens públicas higienizadas.

## Testes
1. Unitário por função com mock apenas de dependências.
2. Nunca mockar a função sob teste.
3. Integração sem mocks internos, somente no fechamento do projeto.
4. Nomenclatura whenThen em camelCase.
