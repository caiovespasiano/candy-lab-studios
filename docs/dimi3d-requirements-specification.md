# Documento de Especificação de Requisitos

## Objetivo
Construir uma landing page premium para portfólio de assets 3D e itens UGC Roblox, com administração privada.

## Stack
1. React para interface.
2. Tailwind CSS para estilização.
3. JavaScript para toda a lógica.

## Requisitos Principais
1. Hero section com identidade da marca e proposta de valor.
2. Galeria com grid responsivo, modal e ação de curtida.
3. Seção social com destaque para Discord e formulário de contato.
4. Footer institucional.
5. Painel admin com ordenação drag-and-drop, visibilidade, templates e background global.

## Segurança
1. Sanitizar entradas e prevenir XSS em todos os campos.
2. Aplicar validação de entrada no cliente e servidor.
3. Nunca expor detalhes sensíveis em erros de API.
4. Mapear status HTTP com payload sanitizado.

## Qualidade
1. SOLID e Clean Code obrigatórios.
2. camelCase obrigatório e snake_case proibido.
3. Máximo de 140 caracteres por linha, exceto Builder.
4. Teste unitário obrigatório por método/função.
5. Testes de integração completos apenas ao final do projeto.
