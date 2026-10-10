"""Conversão explícita da quest v0.1 para o modelo de autoria v2; não infere regras de texto."""
import json,sys
from pathlib import Path
root=Path(sys.argv[1] if len(sys.argv)>1 else '../save-the-prince-bgrpg')
p=root/'projetos/local-1790897190889'; source=p/'quests/ambrosio/cartas.json'
legacy=json.loads(source.read_text()); old={c['id']:c for c in legacy['cartas']}
def target(id=None):return {'tipo':'carta','cartaId':id} if id else {'tipo':'baralho','baralhoId':'ambrosio-candidatos','selecao':'uma'}
def text(s):return {'acao':'texto','texto':s}
def move(id,z='mesa'):return {'acao':'mover','alvo':target(id),'zonaId':z}
def apply(id,cond='aliado'):return {'acao':'aplicar','alvo':target(id),'condicaoId':cond}
def change(n,r='provisoes'):return {'acao':'alterar','recursoId':r,'quantidade':n}
def reveal(id=None):return {'acao':'revelar','alvo':target(id) if id else {'tipo':'baralho','baralhoId':'ambrosio-candidatos','selecao':'todas'}}
def condition(id,cond='aliado'):return {'tipo':'condicao','alvo':target(id),'condicaoId':cond}
def zone(id):return {'tipo':'zona','alvo':target(id),'zonaId':'mesa'}
def count():return {'tipo':'contagem','tagId':'evidencia','zonaId':'mesa','comparador':'>=','quantidade':2}
def branch(req,yes,no=[]):return {'acao':'ramificar','requisito':req,'entao':yes,'senao':no}
def cr(n):return {'tipo':'recurso','recursoId':'provisoes','quantidade':n}
def cc(id):return {'tipo':'carta','cartaId':id,'quantidade':1}
def opt(effects,costs=[],req=None):
 o={'efeitos':effects}
 if costs:o['custos']=costs
 if req:o['requisitos']=req
 return o
rules={
1:[opt([move('E04'),text('Escolham quem fala primeiro e leiam sua frente.')]),opt([apply(None),move('E05'),text('Digam quem ouviu a promessa; improvisar é opcional.')]),opt([change(1),change(1,'alarme'),apply(None,'hostil')])],
2:[opt([move('E01')],[cr(1)]),opt([move('E01'),move('E05')]),opt([change(1)])],
3:[opt([apply('C01')]),opt([reveal('C01'),apply('C01')],[cc('E04')]),opt([reveal('C01'),apply('C01','hostil'),change(1,'alarme')])],
4:[opt([move('E02')],[cr(1)]),opt([move('E02'),move('E05')]),opt([change(1),apply('C03')])],
5:[opt([change(-1,'alarme')],[cr(1)]),opt([branch(condition('C01'),[text('Passem sem custo.')],[move('E05')])]),opt([change(1,'alarme'),move('E10')])],
6:[opt([reveal('C03'),apply('C03'),move('E05')]),opt([reveal('C03'),apply('C03','hostil'),move('E04')]),opt([apply('C03'),change(1),change(1,'alarme')])],
7:[opt([move('E03')],[cr(1)]),opt([move('E03'),text('Inventar a confidência é opcional.')],[cc('E04')]),opt([apply('C02'),move('E08')])],
8:[opt([move('E07')],[cr(2)]),opt([move('E07'),move('E05')]),opt([change(1),move('E04')])],
9:[opt([change(-1,'alarme')],[{'tipo':'condicionado','requisito':condition('C03'),'entao':[],'senao':[cr(1)]}],req={'tipo':'qualquer','itens':[condition('C03'),{'tipo':'recurso','recursoId':'provisoes','comparador':'>=','quantidade':1}]}),opt([move('E05'),change(-1,'alarme')]),opt([change(1,'alarme'),move('E08'),move('E10')])],
10:[opt([reveal('C02'),move('E08'),apply('C02'),change(1,'alarme')]),opt([reveal('C02'),move('E07'),move('E05')]),opt([reveal('C02'),move('E08'),branch(count(),[move('E09')])])],
11:[opt([move('E09'),change(-1,'alarme'),branch(zone('E08'),[],[apply('C02','hostil')])]),opt([branch(zone('E08'),[move('E09'),move('E05')],[move('E08'),move('E05')])]),opt([move('E10'),apply('C02'),change(1,'alarme')])],
12:[opt([move('E05','reserva'),move('E10')],[cr(2)]),opt([branch(condition('C03'),[move('E10')],[move('E10'),move('E05')])]),opt([change(1),move('E09'),move('E10','reserva')])],
13:[opt([apply(None)],[{'tipo':'alternativa','alternativas':[cc('E04'),cr(1)]}]),opt([move('E05','reserva'),change(-1,'alarme')],[cr(2)],zone('E05')),opt([move('E10'),change(1,'alarme')])],
14:[opt([text(o['efeito']),{'acao':'encerrar','texto':'Resolver audiência conforme Q01.'}]) for o in old['S14']['opcoes']]
}
rules[14][1]['efeitos'][-1]['texto']='Resolver refúgio conforme Q01.'
rules[14][2]['efeitos'][-1]['texto']='Encerrar a missão sem entregar ninguém.'
project=json.loads((p/'projeto.json').read_text())
project.update(versaoFormato=2,definicoes={
 'condicoes':[{'id':'aliado','nome':'Aliado','grupoExclusivo':'atitude','descricao':'Atitude cooperativa; substitui Hostil.'},{'id':'hostil','nome':'Hostil','grupoExclusivo':'atitude','descricao':'Atitude adversa; substitui Aliado.'},{'id':'libertado','nome':'Libertado','descricao':'Recuperou sua forma original; independente de atitude.'}],
 'recursos':[{'id':'provisoes','nome':'Provisões','minimo':0,'maximo':5,'inicial':3},{'id':'alarme','nome':'Alarme','minimo':0,'maximo':3,'inicial':0}],
 'tags':[{'id':'evidencia','nome':'Evidência'}],
 'zonas':[{'id':'reserva','nome':'Reserva'},{'id':'mesa','nome':'Mesa'},{'id':'descarte','nome':'Descarte'}]})
converted=[]
for c in legacy['cartas']:
 d={'id':c['id'],'titulo':c['titulo'],'descricao':c['texto'],'imagem':''}
 if c['id']=='Q01':
  d['secoes']=[{'titulo':k.capitalize(),'texto':c[k]} for k in ['objetivo','preparacao','final']]
 elif c['tipo']=='Candidato':
  d['verso']={'titulo':c['titulo'],'descricao':c['verso'],'imagem':''}
  d['condicoes']=[{'condicaoId':cond,'efeitos':[text(c[cond])]} for cond in ['aliado','hostil']]
  d['regras']=[{'evento':'manual','texto':c['revelacao'],'efeitos':[reveal(c['id'])]}]
 elif c['tipo']=='Situação':
  d['opcoes']=[]
  for i,(o,r) in enumerate(zip(c['opcoes'],rules[int(c['id'][1:])])):
   # Custos e efeitos substituem a instrução corrida; o original permanece no arquivo legado.
   d['opcoes'].append({'id':f"{c['id']}-{i+1}",'rotulo':o['rotulo'],**r})
 else:
  d['secoes']=[{'titulo':'Uso','texto':c['efeito']}]
  if c['id'] in ['E01','E02','E03']:
   d['tags']=['evidencia'];d['regras']=[{'evento':'receber','requisitos':count(),'efeitos':[reveal()]}]
  if c['id']=='E05':d['regras']=[{'evento':'reaplicar','efeitos':[change(1,'alarme')]}]
  if c['id']=='E06':d['regras']=[{'evento':'manual','texto':'Quando Alarme mudar, ajustar a presença desta carta na mesa.','efeitos':[branch({'tipo':'recurso','recursoId':'alarme','comparador':'>=','quantidade':1},[move('E06')],[move('E06','reserva')])]}]
  if c['id']=='E07':
   d['regras']=[{'evento':'manual','texto':'Uma vez em S14, antes do destino; verificar consentimento e existência de forma humana conforme Uso.','requisitos':{'tipo':'todos','itens':[zone('E07'),{'tipo':'texto','texto':'S14 está sendo resolvida; o alvo consente em receber o antídoto.'}]},'efeitos':[{'acao':'revelar','alvo':target()},branch({'tipo':'texto','texto':'O candidato selecionado tinha uma forma humana: Frederico ou Ambrósio.'},[apply(None,'libertado')]),move('E07','reserva')]}]
 converted.append(d)
(p/'baralhos').mkdir(exist_ok=True)
types=[('quest','Quest',lambda c:c['id'].startswith('Q')),('situacoes','Situações',lambda c:c['id'].startswith('S')),('candidatos','Candidatos',lambda c:c['id'].startswith('C')),('consequencias-estados','Consequências e Estados',lambda c:c['id'].startswith('E'))]
files=[]
for slug,label,pred in types:
 filename=f'ambrosio-{slug}.json';files.append(filename);cs=[c for c in converted if pred(c)]
 deck={'versaoFormato':2,'id':f'ambrosio-{slug}','tipo':label,'nome':f'Ambrósio — {label}','descricao':'O Príncipe Virou Sapo. De Novo. — protótipo de autoria v2','quantidade':len(cs),'cartasProntas':len(cs),'simbolo':'✦','tamanho':'70 × 120 mm (tarô)','material':'Couche fosco','espessura':'300 g/m²','imagemVerso':'','imagemFrame':'','cartas':cs}
 (p/'baralhos'/filename).write_text(json.dumps(deck,ensure_ascii=False,indent=2)+'\n')
project['baralhos']=list(dict.fromkeys([*project.get('baralhos',[]),*files]))
(p/'projeto.json').write_text(json.dumps(project,ensure_ascii=False,indent=2)+'\n')
legacy['status']='LEGADO — arquivo histórico v0.1; editar os quatro baralhos registrados no projeto.'
legacy['substituidoPor']=[f'baralhos/{f}' for f in files]
source.write_text(json.dumps(legacy,ensure_ascii=False,indent=2)+'\n')
readme=p/'quests/ambrosio/README.md'
s=readme.read_text();s=s.replace('O conjunto fica em uma pasta própria e não altera o índice nem o diário existentes.','O conteúdo editável agora está nos quatro JSON em `../../baralhos/`, registrados em `../../projeto.json`. Este diretório preserva a documentação e a versão histórica v0.1. Os Markdown são referências históricas: alterações posteriores devem partir dos baralhos v2. O índice de projetos e o diário foram preservados.\n\nA composição usa tamanho tarô (70 × 120 mm) como ponto de partida; o builder alerta sobre excesso de texto. Este tamanho ainda precisa de validação de impressão.')
s=s.replace('`cartas.json`: o mesmo conteúdo estruturado para edição ou diagramação. É um formato próprio deste protótipo; não há integração comprovada com o app do projeto.','`cartas.json`: arquivo histórico v0.1, mantido para rastreabilidade. Os quatro baralhos v2 são compatíveis com o editor estruturado do card-builder.')
readme.write_text(s)
print('Migradas 28 cartas em quatro baralhos; projeto registrado; origem marcada como legado.')
