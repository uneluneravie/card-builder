"""Move opções atuais para resoluções no verso, preservando edições e IDs da origem.
Uso: python tools/migrate-option-resolutions.py /caminho/do/save-the-prince-bgrpg
Não usa o JSON histórico nem regenera o conteúdo da quest.
"""
import json,sys
from pathlib import Path
root=Path(sys.argv[1]);p=root/'projetos/local-1790897190889'
file=p/'baralhos/ambrosio-situacoes.json';deck=json.loads(file.read_text())
hints={
'S01':['Deixem cada sapo falar sem oferecer garantias.','Assumam perante os moradores a responsabilidade por um dos sapos.','Façam a autoridade da corte valer, mesmo longe do palácio.'],
'S02':['A correnteza pode levar parte do que vocês carregam.','Os moradores conhecem as águas, mas favores raramente são esquecidos.','Preservem o que carregam e deixem a água seguir seu curso.'],
'S03':['Não o obriguem a explicar seu passado.','Uma conversa franca exige confiança de ambos os lados.','Peçam que ele prove suas palavras diante de todos.'],
'S04':['Ofereçam parte dos mantimentos pelo tempo da lavadeira.','Prometam retribuir quando ela precisar.','As redes não vão se lavar sozinhas; a conversa pode esperar.'],
'S05':['Entreguem o pedágio sem chamar atenção.','Apostem na influência de quem conhece a corte.','Troquem a estrada vigiada por um caminho desconhecido.'],
'S06':['Deem a Pipoca a chance de explicar-se longe da criança.','Não aceitem que ele continue sustentando a história diante de todos.','Entrem no teatro e sustentem sua versão perante os moradores.'],
'S07':['Usem parte do que carregam para recompor a superfície.','Ofereçam algo que só se conta a quem merece confiança.','Recusem a troca e impeçam o espelho de exigir mais lembranças.'],
'S08':['Ofereçam mantimentos pelo frasco.','Aceitem que a boticária venha cobrar depois.','Ajudem a cuidar dos sapos e sigam sem comprar o frasco.'],
'S09':['Criem uma distração com a ajuda de Pipoca ou usando o que carregam.','Façam um acordo para que o capitão deixe vocês passarem.','Atravessem a linha da patrulha antes que o cerco se feche.'],
'S10':['Deem a ele tempo para falar, apesar da caçada.','Pressionem a feiticeira a reparar o dano agora.','Confrontem o contrato com aquilo que vocês descobriram.'],
'S11':['Confiem no convite, mesmo sem uma promessa clara sobre o futuro do sapo.','Tentem transformar a promessa vaga em um compromisso da corte.','Digam que o destino dos sapos não será decidido no palácio.'],
'S12':['Usem seus mantimentos para honrar os compromissos assumidos.','Peçam que uma relação construída na viagem abra as portas.','Priorizem os preparativos para voltar ao palácio.'],
'S13':['Ofereçam cuidado ou recursos para reconstruir a confiança.','Separem mantimentos para encerrar a obrigação antes de partir.','Deixem pronto um caminho que não dependa da corte.'],
'S14':['Escolham um único sapo para apresentar à corte.','Escolham quem desejam ajudar a construir uma vida longe do palácio.','Recusem a entrega e deixem os sapos escolher seus caminhos.']}
changed=0
for c in deck['cartas']:
 if not c.get('opcoes'):continue
 verso=c.setdefault('verso',{})
 verso.setdefault('titulo',c['titulo']+' — Resoluções')
 verso.setdefault('descricao','Escolham antes de virar. Leiam somente a resolução vinculada à opção escolhida; paguem seu custo antes de aplicar os efeitos.')
 resolutions=verso.setdefault('resolucoes',[])
 for i,o in enumerate(c['opcoes']):
  if o.get('resolucao'):continue
  rid=o['id']+'-R'
  if any(r.get('id')==rid for r in resolutions):raise ValueError('Colisão de resolução: '+rid)
  r={'id':rid,'titulo':o['rotulo']}
  for key in ['custos','efeitos']:
   if key in o:r[key]=o.pop(key)
  if not o.get('texto') and c['id'] in hints and i<len(hints[c['id']]):o['texto']=hints[c['id']][i]
  o['resolucao']={'resolucaoId':rid};resolutions.append(r);changed+=1
file.write_text(json.dumps(deck,ensure_ascii=False,indent=2)+'\n')
qfile=p/'baralhos/ambrosio-quest.json';quest=json.loads(qfile.read_text())
for c in quest['cartas']:
 finals=[s for s in c.get('secoes',[]) if s.get('titulo','').lower()=='final']
 if not finals:continue
 c['secoes']=[s for s in c['secoes'] if s not in finals]
 c['secoes'].append({'titulo':'Encerramento','texto':'A qualquer momento, vocês podem escolher levar apenas UM sapo à audiência, ou seguir até S14. Comprometam-se com a escolha antes de ler o desfecho no verso.'})
 verso=c.setdefault('verso',{});verso.setdefault('titulo',c['titulo']+' — Desfechos');verso.setdefault('descricao','Leiam depois de escolher quem levar e qual destino tentar.');verso.setdefault('secoes',[]).extend(finals)
qfile.write_text(json.dumps(quest,ensure_ascii=False,indent=2)+'\n')
print(f'{changed} opções migradas; textos, metadados, condições e requisitos originais preservados.')
