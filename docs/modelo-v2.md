# Modelo de autoria v2

O builder descreve e compõe cartas. Não mantém estado de partida nem executa regras. Condições, exclusividade, custos e gatilhos são instruções representadas para os jogadores.

## Compatibilidade e organização

A hierarquia permanece `projetos/index.json` → `projeto.json` → `baralhos/*.json`. O array `projeto.baralhos` contém nomes de arquivos. Cada tipo de carta pode ter seu próprio baralho, inclusive com uma única carta.

Baralhos v2 têm `versaoFormato: 2`, `id`, `tipo` livre, `quantidade`, `cartas` e os metadados de produção antigos. `quantidade` deve corresponder ao número de cartas. IDs de cartas são únicos em todo o projeto; IDs de opções são únicos dentro da carta. Referências usam IDs, nunca títulos ou índices.

Cartas antigas mantêm `titulo`, `descricao`, `imagem` e campos adicionais. Não exigem condições ou recursos. Editar uma carta antiga adiciona um ID sem apagar campos desconhecidos. Remover um campo estruturado no editor remove o campo do JSON; redução de quantidade que apagaria cartas é bloqueada.

## Definições do projeto

`projeto.definicoes` contém arrays opcionais:

| Campo | Definição |
|---|---|
| `condicoes` | `id`, `nome`, `descricao`, `grupoExclusivo` opcional |
| `recursos` | `id`, `nome`, `minimo`, `maximo`, `inicial` |
| `tags` | `id`, `nome` |
| `zonas` | `id`, `nome` |

Uma condição é um estado aplicável a uma carta. Condições do mesmo grupo de exclusividade substituem-se. Ausência das condições de um grupo não requer criar outra condição: por exemplo, Neutro pode ser ausência de Aliado e Hostil. Os efeitos vinculados à condição ficam em cada carta e podem variar por entidade.

## Campos opcionais das cartas

| Campo | Conteúdo |
|---|---|
| `id` | Identificador estável |
| `tags` | IDs de tags |
| `secoes` | Blocos `{titulo, texto}` |
| `verso` | `{titulo, descricao, imagem, secoes}`; conteúdo individual |
| `opcoes` | `{id, rotulo, texto, requisitos, custos, efeitos}` |
| `condicoes` | `{condicaoId, efeitos}` |
| `regras` | `{evento, texto, requisitos, efeitos}` |

Texto narrativo fica em `descricao`; o texto explicativo opcional acompanha regras estruturadas e não produz um segundo efeito. Instruções que exigem interpretação humana podem usar `texto` explicitamente. Ao revisar uma regra, conferir também seu texto explicativo; o builder não traduz automaticamente regras em narrativa nem verifica equivalência semântica.

## Alvos

- `{tipo: "carta", cartaId: "C01"}`: carta determinada.
- `{tipo: "baralho", baralhoId: "candidatos", selecao: "uma"}`: escolher uma carta do baralho.
- A seleção `"todas"` envolve todas as cartas do baralho.
- `{tipo: "grupo"}`: grupo de jogadores.

Em uma regra com várias operações sobre um alvo escolhido, manter a seleção para a sequência inteira; não escolher outra carta para cada operação.

## Requisitos

`tipo` pode ser `texto`, `condicao`, `recurso`, `zona`, `contagem`, `todos`, `qualquer` ou `nao`.

- Condição: `alvo` e `condicaoId`.
- Recurso: `recursoId`, `comparador` (`>=`, `<=`, `==`) e `quantidade`.
- Zona: `alvo` e `zonaId`.
- Contagem: `tagId`, `zonaId`, `comparador`, `quantidade`; contar cartas distintas.
- Composição: `itens` com requisitos; `nao` recebe exatamente um.
- Texto: `texto` descreve uma verificação feita pelos jogadores.

## Custos

- `recurso`: `recursoId`, `quantidade` positiva.
- `carta`: `cartaId`, `quantidade` positiva; nesta quest, pagar significa devolver a carta à reserva.
- `alternativa`: `alternativas` com custos; pagar exatamente uma alternativa.
- `condicionado`: `requisito`, `entao`, `senao` com listas de custos; lista vazia significa sem custo.

Uma opção só pode ser escolhida se o requisito for atendido e todos os custos da alternativa aplicável estiverem disponíveis. Pagar os custos antes de aplicar os efeitos; em custo de carta única, ela deve estar na mesa.

## Efeitos

`acao` pode ser:

| Ação | Campos |
|---|---|
| `texto` | `texto` para resolução humana |
| `mover` | `alvo`, `zonaId` |
| `aplicar` / `remover` | `alvo`, `condicaoId` |
| `alterar` | `recursoId`, `quantidade` com sinal |
| `revelar` | `alvo`; ler o verso individual |
| `ramificar` | `requisito`, `entao`, `senao` com efeitos |
| `encerrar` | `texto` descrevendo o desfecho |

Aplicar efeitos em ordem; limitar contadores aos limites definidos. Mover uma carta para a mesa produz o evento `receber`; se já estiver lá, produz `reaplicar` e não outra cópia. Revelar pela primeira vez produz `revelar`. `manual` identifica ações opcionais ou instruções acionadas pelos jogadores. Requisitos restringem um gatilho; não são efeitos.

## Interface e validação

O botão “Condições e recursos do projeto” edita definições compartilhadas. O editor de cartas permite adicionar campos, listas, opções e regras, selecionar referências, ordenar itens e remover com confirmação. Versos são abertos por um botão separado e nunca misturados ao preview da frente.

A validação verifica IDs, referências, contagens, recursos e campos essenciais de operações. Não determina se uma regra textual está correta ou se as escolhas estão balanceadas. O preview avisa quando o texto ultrapassa o espaço da carta; o aviso não garante legibilidade impressa. Imprimir e medir continuam necessários antes de produção.

## Verificação

```bash
node tests/model.test.js /caminho/do/save-the-prince-bgrpg/projetos/local-1790897190889
```

O script `tools/migrate-ambrosio.py` é uma migração específica, explícita e revisável da quest, separada do modelo genérico. Não deve ser usado como importador universal.

Para os testes de navegador, execute `npm ci`, `npx playwright install chromium` e `node tests/browser.test.js /caminho/do/save-the-prince-bgrpg`. O teste inicia um servidor local e simula a API GitHub: não usa credenciais nem escreve nos repositórios. `CHROMIUM_EXECUTABLE_PATH` permite usar um Chromium já instalado.


## Opções públicas e resoluções vinculadas (v2, campos opcionais)

Uma opção pode manter `requisitos` e apontar para `resolucao: {resolucaoId}`. A resolução local fica em `carta.verso.resolucoes`, com `id`, `titulo`, `texto` opcional, `custos` e `efeitos`. Não duplicar custos/efeitos na opção vinculada. O verso renderiza as resoluções; a frente exibe somente a opção, seu texto público, requisitos e código de leitura.

A disponibilidade para pagar um custo também é um pré-requisito público. O renderer a calcula a partir dos custos da resolução: recurso suficiente, carta disponível, alternativas e custos condicionados. Assim, alterar um custo no editor atualiza a informação pública sem duplicar os dados. A disponibilidade é verificada antes da escolha; o custo é pago após revelá-la, antes dos efeitos. Não há execução automática. Os testes de um custo condicionado usam o estado no momento da escolha.

Para usar um baralho separado posteriormente, declarar `resolucao: {cartaId, resolucaoId}` na opção. A carta de destino pode manter `resolucoes` na frente ou no verso. O vínculo usa IDs estáveis; mudar de localização não exige reescrever os efeitos. A ferramenta valida referências locais/externas e IDs duplicados, mas não sorteia variantes nem transforma isso automaticamente em rejogabilidade.

Cartas antigas com custos/efeitos diretamente nas opções mantêm a apresentação anterior. A ocultação é ativada pelo vínculo explícito, sem alterar silenciosamente outros jogos. O editor é um ambiente de autoria: os dados completos continuam disponíveis para editar, mesmo quando o preview da frente não os mostra. Essa separação não é um mecanismo de controle de acesso.

Exemplo:

```json
{
  "id": "S02",
  "titulo": "O sinete sob a água",
  "descricao": "Uma correnteza leva o sinete.",
  "opcoes": [{
    "id": "S02-1",
    "rotulo": "Mergulhar juntos",
    "resolucao": {"resolucaoId": "S02-1-R"}
  }],
  "verso": {
    "resolucoes": [{
      "id": "S02-1-R",
      "titulo": "Mergulhar juntos",
      "custos": [{"tipo": "recurso", "recursoId": "provisoes", "quantidade": 1}],
      "efeitos": [{"acao": "texto", "texto": "Recuperem o sinete."}]
    }]
  }
}
```

A frente deste exemplo mostra `Provisões >= 1`, sem mostrar o efeito. O código identifica a resolução a ler depois da decisão.
