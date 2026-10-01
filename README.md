# Casa de Cartas

Protótipo one-page para gestão de projetos de jogos, diários, baralhos e cartas. A interface funciona sem etapa de build e persiste os primeiros rascunhos no `localStorage`.

## Executar

```bash
python3 -m http.server 4173
```

Abra `http://localhost:4173`.

## Estrutura dos projetos

Os projetos disponíveis são declarados em `projetos/index.json`. Cada item aponta para uma subpasta com os metadados em `projeto.json`, atividades em JSON, um diário e um diretório `baralhos/`, que mantém um arquivo JSON independente para cada baralho. Cada baralho também declara suas cartas e referências de imagens no próprio JSON. A aplicação só solicita esses arquivos depois que o usuário abre o projeto correspondente.

```text
projetos/
├── index.json
└── nome-do-projeto/
    ├── projeto.json
    ├── atividades.json
    ├── diario/
    │   └── paginas.json
    └── baralhos/
        └── nome-do-baralho.json
```

O índice começa vazio para que cada instalação crie seus próprios projetos. Projetos criados pela interface começam como rascunhos locais serializados em JSON no `localStorage`, pois uma aplicação estática no navegador não pode escrever diretamente nos arquivos do repositório. A exclusão também é local: projetos do repositório são ocultados neste navegador, sem apagar seus arquivos de origem.

## Decisão sobre a composição das cartas

A primeira versão deve compor título, texto e imagem em HTML/CSS. Isso mantém o conteúdo acessível, responsivo, serializável e fácil de editar, além de permitir uma futura exportação para bitmap ou PDF com uma biblioteca de captura. Uma ferramenta gráfica embarcada só passa a compensar caso o produto exija posicionamento livre, máscaras complexas ou edição de imagem destrutiva.

## Persistência e GitHub

Ao abrir a aplicação, a conexão com o GitHub é sempre solicitada antes do carregamento dos projetos. O formulário usa os campos semânticos de usuário e senha para que o gerenciador de senhas do navegador possa oferecer o salvamento do repositório e do PAT. O aplicativo não grava o token por conta própria.

Depois da autenticação, `projetos/index.json` e todos os JSON relacionados são lidos diretamente do repositório informado. Esses dados são a fonte de verdade e substituem rascunhos ou exclusões que tenham ficado no armazenamento local.

A conexão com o GitHub valida o repositório e o Personal Access Token diretamente pela API, usando somente cabeçalhos aceitos nas requisições CORS do navegador. A credencial permanece apenas na memória da aba (ou, mediante autorização do usuário, no cofre de senhas do navegador) e é descartada pelo aplicativo ao desconectar, recarregar ou fechar a página — ela nunca é incluída no JSON do projeto, em commits ou em logs. Alterações concluídas entram em uma fila e atualizam imediatamente os arquivos JSON correspondentes em `projetos/`; se algum envio falhar, a fila é preservada para uma nova tentativa automática. Enquanto a conexão está ativa, também é feita uma verificação da fila a cada 60 segundos.
