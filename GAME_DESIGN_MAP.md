# Mapa de Game Design — Leilão da Meia-Noite

Versão de referência: agosto de 2026.

## Visão do jogo

Jogo social competitivo para 3 ou 4 pessoas. Cada jogador usa ouro para disputar relíquias, transforma peças em infusões, negocia com rivais e administra poderes e maldições. O vencedor é quem possui mais Prestígio depois de quatro atos.

Pilares:

1. **Leilão com leitura de mesa:** decidir quanto uma peça vale para você e quanto vale impedir um rival de comprá-la.
2. **Museu como construção de estratégia:** cada relíquia altera recursos, cria ameaças ou abre uma receita de infusão.
3. **Negociação social:** vender pode ser correto mesmo fortalecendo outro jogador, pois gera ouro e Prestígio.
4. **Informação incompleta:** talentos, intenção de compra e Intrigas Secretas dificultam saber o plano real de cada jogador.
5. **Risco controlado:** maldições, missões e poderes de chance oferecem efeitos fortes com custos legíveis.

## Fluxo completo

```mermaid
flowchart TD
  A[Conta e máscara permanente] --> B[Árvore do Patronato]
  B --> C[Lobby público]
  C --> D[Sala de 3 ou 4 jogadores]
  D --> E[Cada jogador recebe 3 Intrigas]
  E --> F[Escolhe 1 em segredo]
  F --> G[Ato 1: 3 lotes]
  G --> H[Renda e reset do Museu]
  H --> I[Ato 2: 3 lotes]
  I --> J[Votação entre 7 Itens Proibidos]
  J --> K[Ato 3: Item Proibido + 2 lotes]
  K --> L[Renda e reset do Museu]
  L --> M[Ato 4: 3 lotes]
  M --> N[Revelação das Intrigas]
  N --> O[Cálculo de Prestígio]
  O --> P[Vencedor recebe 3 Lúmens]
  P --> C
```

## Estrutura da partida

| Elemento | Regra atual |
|---|---|
| Jogadores | Exatamente 3 ou 4 pessoas reais |
| Atos | 4 |
| Lotes | 3 por ato, 12 no total |
| Ouro inicial | 15; Bolsa do Patrono acrescenta 3 |
| Renda entre atos | 5, com bônus e descontos de talentos, pobreza e maldições |
| Esmola do Anfitrião | Jogadores empatados com o menor ouro recebem +2 |
| Ativações de artefatos | 2 por ato; talentos elevam para 3 e depois 4 |
| Infusões | No máximo 1 por ato; dupla custa 2, tripla custa 4 |
| Compras de rivais | 1 por ato; Contrabandista permite 2 |
| Votação proibida | Depois do sexto lote; empate é decidido aleatoriamente |
| Vitória | Maior Prestígio final |

## Recursos e conversões

### Ouro

Entradas: renda, Esmola do Anfitrião, poderes, reembolsos e vendas.

Saídas: lances, compras, infusões, multas, conversões e talentos ativos.

No placar final, cada 4 moedas valem 1 Prestígio, limitado a 3. Isso evita que guardar ouro seja melhor do que participar do leilão.

### Prestígio

O placar é calculado assim:

```text
Prestígio final =
  valor das relíquias e infusões no Museu
  + bônus de talentos, poderes e vendas
  + bônus da Intriga Secreta cumprida
  + bônus de ouro restante (máximo 3)
  - penalidades de maldições
```

Infusões já possuem seu próprio valor de Prestígio e substituem as peças consumidas. Elas não recebem uma segunda pontuação de combo, evitando contagem dupla.

### Lúmens

São a progressão permanente da conta. O vencedor recebe 3 Lúmens. O primeiro talento é gratuito; os seguintes custam 2, 3, 5, 8 ou 12 conforme a profundidade da árvore.

## Conteúdo atual

| Sistema | Quantidade | Função |
|---|---:|---|
| Relíquias comuns | 28 | Formam o baralho de 12 lotes |
| Itens Proibidos | 7 | Candidatos à votação do meio da partida |
| Infusões | 27 | Transformações duplas ou triplas |
| Talentos | 27 | Progressão permanente em 5 ramos |
| Intrigas Secretas | 8 | Objetivos de partida com recompensa de 4 ou 5 Prestígios |
| Personagens | 4 | Identidade visual permanente, sem passiva própria |

## Intrigas Secretas

Cada jogador recebe três opções aleatórias e escolhe uma. O servidor remove as opções e o objetivo dos rivais antes de enviar o estado a cada cliente. Somente a indicação “intriga selada” é pública. Todos os objetivos são revelados depois do último lote e antes do placar.

| Intriga | Condição | Recompensa |
|---|---|---:|
| Sangue Azul | 3 relíquias de Realeza | +4 |
| Mercador de Cadáveres | 2 relíquias vendidas | +4 |
| Mãos Ensanguentadas | 3 poderes direcionados contra rivais | +5 |
| Devoto do Proibido | 1 Item Proibido no Museu | +5 |
| Museu Amaldiçoado | 3 maldições ativas | +5 |
| Último Apostador | No máximo 1 moeda ao final | +4 |
| Colecionador Obsessivo | 5 relíquias no Museu | +5 |
| Conspirador da Corte | Negociar com 2 jogadores diferentes | +4 |

Decisões de equilíbrio:

- A recompensa representa aproximadamente o valor de uma relíquia forte, suficiente para mudar o vencedor sem apagar o restante da partida.
- Os objetivos de 5 pontos exigem risco maior ou dependem de uma disputa mais difícil.
- Infundir reduz a quantidade de peças e pode atrapalhar Colecionador Obsessivo, criando uma decisão real.
- Purificar uma maldição pode atrapalhar Museu Amaldiçoado, impedindo que a escolha seja automática.
- Vender ajuda objetivos de negociação, mas entrega uma peça ao rival.

## Auditoria funcional

| Sistema | Estado | Verificação |
|---|---|---|
| Conta, máscara e talentos permanentes | Operacional | API persiste conta, personagem, Lúmens e talentos |
| Lobby e salas | Operacional | Testes com 3 e 4 conexões reais |
| Sincronização da partida | Operacional | Controle de versão e reconexão por WebSocket |
| Privacidade das Intrigas | Operacional | Servidor personaliza o estado por jogador e revela apenas no final |
| Leilão e rotação | Operacional | Lance mínimo, ouro, desconto, desistência e martelo usam estado compartilhado |
| Renda entre atos | Operacional | Reseta limites do ato e aplica pobreza, talentos e maldições |
| Museu e poderes | Operacional | Limite de ativações calculado no motor e exibido na interface |
| Negociação | Operacional | Oferta, contraproposta, venda, Prestígio e parceiros são sincronizados |
| Infusões | Operacional | Componentes válidos, custos fixos e limite de uma por ato |
| Votação proibida | Operacional | 7 candidatos, voto duplo do Oráculo e desempate aleatório |
| Intrigas e placar | Operacional | Progresso das 8 condições e bônus incluído no total final |
| Progressão pós-partida | Operacional | Servidor concede 3 Lúmens uma única vez ao vencedor |

## Verificações automáticas do mapa

Os testes do projeto validam:

- IDs únicos em relíquias, proibidos, infusões, talentos e intrigas;
- árvore de talentos sem dependências inexistentes ou invertidas;
- todas as receitas com componentes existentes e custos corretos;
- todos os poderes ligados a um tipo reconhecido pelo motor;
- baralho com 12 lotes comuns e sem duplicatas;
- progresso calculável para as oito Intrigas;
- bônus da Intriga dentro da fórmula final;
- privacidade da escolha entre clientes e revelação ao final;
- criação e início de salas de 3 e 4 jogadores.

## Pontos para observar em playtests

Não são falhas técnicas; são números que dependem do comportamento do grupo:

1. **Último Apostador:** observar se quatro pontos tornam gastar todo o ouro uma escolha interessante sem ser automática.
2. **Devoto do Proibido:** verificar se o jogador fica previsível demais durante o sétimo lote.
3. **Mãos Ensanguentadas:** acompanhar se três ataques é fácil demais para builds com muitos poderes direcionados.
4. **Duração:** medir se a escolha inicial e a revelação adicionam menos de três minutos à partida.
5. **Recompensas:** após algumas partidas, comparar quantas vezes objetivos de 4 e 5 pontos são concluídos.

O estado atual está fechado tecnicamente. O próximo ajuste recomendado deve vir de partidas reais, principalmente da taxa de conclusão das Intrigas e da diferença média de Prestígio entre primeiro e segundo lugar.
