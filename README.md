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

O protótipo salva rascunhos localmente. A integração planejada usa a API do GitHub com um fine-grained Personal Access Token limitado ao repositório escolhido. O token deve permanecer apenas na memória da sessão e nunca ser incluído no JSON do projeto, em commits ou em logs.
