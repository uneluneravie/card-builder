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

Projetos criados pela interface começam como rascunhos locais serializados em JSON no `localStorage`, pois uma aplicação estática no navegador não pode escrever diretamente nos arquivos do repositório. A exclusão também é local: projetos do repositório são ocultados neste navegador, sem apagar seus arquivos de origem.

## Decisão sobre a composição das cartas

A primeira versão deve compor título, texto e imagem em HTML/CSS. Isso mantém o conteúdo acessível, responsivo, serializável e fácil de editar, além de permitir uma futura exportação para bitmap ou PDF com uma biblioteca de captura. Uma ferramenta gráfica embarcada só passa a compensar caso o produto exija posicionamento livre, máscaras complexas ou edição de imagem destrutiva.

## Persistência e GitHub

Cada criação ou edição concluída é salva imediatamente no `localStorage`. Campos de projeto, baralho e diário em edição também são considerados rascunhos, mesmo antes do envio do formulário.

A conexão com o GitHub valida o repositório e o Personal Access Token diretamente pela API. A credencial permanece apenas na memória da aba e é descartada ao desconectar, recarregar ou fechar a página — ela nunca é incluída no JSON do projeto, em commits ou em logs. Enquanto a conexão está ativa, a interface exibe uma contagem regressiva de 60 segundos e publica em `.card-builder/autosave.json` somente quando o conteúdo diverge do último sync. Concluir uma alteração força o envio imediatamente e reinicia a contagem.
