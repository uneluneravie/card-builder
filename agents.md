# Diretrizes do Card Builder

## Produto
- A aplicação gerencia projetos de jogos de cartas em uma única página responsiva.
- A hierarquia principal é **Projetos → Diário / Baralhos → Cartas**.
- O inventário deve ser simples de consultar, com busca, filtros e contagens sempre visíveis.
- A interface é somente light mode, usa tons quentes e claros (sem branco puro) e mantém contraste AA.

## Experiência
- Escrever toda a interface em português do Brasil.
- Priorizar leitura confortável, alvos de toque de no mínimo 44 px e navegação por teclado.
- Em telas pequenas, transformar a barra lateral em uma navegação compacta e manter a ação principal acessível.
- Confirmar ações destrutivas e oferecer feedback imediato para salvamentos.
- Usar estados vazios que expliquem o próximo passo.

## Funcionalidades iniciais
1. Carregar um projeto existente ou criar um projeto com nome, imagem e descrição curta.
2. Criar páginas de diário com título, texto, títulos internos e listas com bullets.
3. Criar baralhos com nome, quantidade de cartas, espessura e material do papel, tamanho padrão ou personalizado, imagem do verso e imagem do frame.
4. Exibir todas as cartas do baralho em grade, com busca e filtros de status.
5. Compor cada carta por título, texto e imagem, mantendo a composição estruturada em HTML/CSS para edição e preview rápidos.
6. Persistir rascunhos localmente e publicar atualizações em um repositório GitHub por meio de um PAT informado pelo usuário.

## Arquitetura e dados
- Nunca persistir o PAT no repositório nem em logs; manter a sessão apenas no navegador e mascarar o token.
- Separar os dados do conteúdo visual. Projetos, diários, baralhos e cartas devem ser serializáveis em JSON.
- Manter imagens como referências de arquivo/URL e prever integração futura com upload para o repositório.
- Preferir componentes sem dependências e HTML semântico. Ícones devem ter rótulo acessível.
- Para cartas, começar com HTML/CSS: é leve, editável, responsivo e pode ser exportado posteriormente com canvas (por exemplo, html-to-image). Só adotar ferramenta embarcada quando houver necessidade comprovada de edição gráfica livre.

## Qualidade
- Testar os breakpoints de celular (360 px), tablet (768 px) e desktop (1280 px).
- Respeitar `prefers-reduced-motion`.
- Não introduzir branco puro (`#fff`) como fundo de superfícies.
- Validar estados de foco, contraste, formulários e navegação por teclado antes de publicar.

