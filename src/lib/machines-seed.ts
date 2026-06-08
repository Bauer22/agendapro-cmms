export const DEFAULT_MACHINES = [
  {
    code:'TOR-001', name:'Torno Laminador', sector:'Laminação', category:'production', icon:'🔩',
    location:'Galpão A - Linha 1',
    components:['Fusos','Mancais','Rolamentos','Correntes','Engrenagens','Acoplamentos','Eixos','Bomba hidráulica','Reservatório','Filtros hidráulicos','Válvulas','Cilindros','Motor principal','Inversor','CLP','Sensores','Painel elétrico','Cortina de segurança','Botão de emergência'],
    pm_plan:[
      {task:'Verificar vazamentos',period:'daily'},
      {task:'Verificar óleo hidráulico',period:'daily'},
      {task:'Limpeza geral',period:'daily'},
      {task:'Lubrificação',period:'weekly'},
      {task:'Inspeção de correntes',period:'weekly'},
      {task:'Verificar alinhamento',period:'monthly'},
      {task:'Verificar rolamentos',period:'monthly'},
      {task:'Troca de filtros hidráulicos',period:'semiannual'},
    ]
  },
  {
    code:'SEC-001', name:'Secador', sector:'Secagem', category:'production', icon:'🌡️',
    location:'Galpão B',
    components:['Câmara','Portas','Trilhos','Ventiladores','Mancais ventiladores','Motores ventiladores','Trocadores de calor','Tubulações','Dampers','Painéis elétricos','Sensores temperatura','Controladores'],
    pm_plan:[
      {task:'Verificar temperatura',period:'daily'},
      {task:'Verificar ventiladores',period:'daily'},
      {task:'Limpeza interna',period:'weekly'},
      {task:'Verificação dos motores',period:'monthly'},
      {task:'Limpeza dos trocadores',period:'monthly'},
    ]
  },
  {
    code:'PRE-001', name:'Prensa', sector:'Montagem', category:'production', icon:'⬇️',
    location:'Galpão C',
    components:['Chassi','Platôs','Bomba hidráulica prensa','Cilindros prensa','Válvulas prensa','CLP prensa','Sensores prensa','Motores prensa','Botão emergência prensa','Barreiras de segurança'],
    pm_plan:[
      {task:'Verificar pressão hidráulica',period:'daily'},
      {task:'Verificar vazamentos',period:'daily'},
      {task:'Lubrificação',period:'weekly'},
      {task:'Verificar cilindros',period:'monthly'},
      {task:'Calibração',period:'quarterly'},
    ]
  },
  {
    code:'CAL-001', name:'Caldeira', sector:'Utilidades', category:'utility', icon:'🔥',
    location:'Casa de força',
    components:['Bombas alimentação','Tanques','Grelha','Alimentador biomassa','Tubulações vapor','Válvulas vapor','Pressostatos','Sensores','Indicadores nível'],
    pm_plan:[
      {task:'Teste de alarmes',period:'daily'},
      {task:'Verificar nível de água',period:'daily'},
      {task:'Purga',period:'daily'},
      {task:'Teste de válvulas de segurança',period:'weekly'},
      {task:'Limpeza interna',period:'monthly'},
      {task:'Inspeção NR-13',period:'annual'},
    ]
  },
  {
    code:'EMP-001', name:'Empilhadeira', sector:'Pátio', category:'transport', icon:'🏗️',
    location:'Pátio externo', current_hours:0, oil_interval:250, last_oil_hours:0,
    components:['Motor empilhadeira','Filtros motor','Correias','Bomba hidráulica empilhadeira','Cilindros garfo','Mangueiras hidráulicas','Pneus','Rolamentos rodagem','Bateria','Alternador'],
    pm_plan:[
      {task:'Verificar nível de óleo',period:'daily'},
      {task:'Verificar pneus',period:'daily'},
      {task:'Verificar freios',period:'daily'},
      {task:'Troca de óleo motor',period:'quarterly'},
      {task:'Troca de filtros',period:'semiannual'},
    ]
  },
  {
    code:'CAR-001', name:'Carregadeira', sector:'Pátio', category:'transport', icon:'🚜',
    location:'Pátio toras', current_hours:0, oil_interval:500, last_oil_hours:0,
    components:['Motor diesel carregadeira','Filtros diesel','Turbina','Bomba hidráulica carregadeira','Comandos hidráulicos','Mangueiras carregadeira','Conversor torque','Diferencial','Pneus carregadeira','Eixos'],
    pm_plan:[
      {task:'Verificar níveis',period:'daily'},
      {task:'Verificar vazamentos',period:'daily'},
      {task:'Lubrificação completa',period:'quarterly'},
      {task:'Troca de filtros',period:'semiannual'},
      {task:'Revisão geral',period:'annual'},
    ]
  },
  {
    code:'COM-001', name:'Compressor', sector:'Utilidades', category:'utility', icon:'💨',
    location:'Sala compressores',
    components:['Elemento compressor','Válvulas compressor','Motor compressor','Radiador','Ventiladores resfriamento','Reservatório ar','Rede de ar comprimido','Filtro de ar','Separador ar/óleo'],
    pm_plan:[
      {task:'Verificar pressão',period:'daily'},
      {task:'Verificar temperatura',period:'daily'},
      {task:'Drenagem do reservatório',period:'weekly'},
      {task:'Limpeza de filtros',period:'monthly'},
      {task:'Troca do óleo',period:'annual'},
      {task:'Troca separador ar/óleo',period:'annual'},
    ]
  },
]
