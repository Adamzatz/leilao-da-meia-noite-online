# Leilão da Meia-Noite Online

Jogo de leilão para 2 a 8 pessoas, com lobby público, salas flexíveis, reconexão e partidas sincronizadas em tempo real. Também há treino solo com 1 a 7 bots da Crônica; partidas solo não geram Lúmens nem vitórias.

Jogue em produção: [leilaodameianoite.shardweb.app](https://leilaodameianoite.shardweb.app)

Talentos, negociações, poderes de relíquias e infusões são aplicados ao estado compartilhado da sala e sincronizados com todos os participantes.

O menu principal inclui a Biblioteca da Meia-Noite, com 42 relíquias comuns, 34 receitas de infusão, 8 Itens Proibidos e 8 Intrigas Secretas. Cada partida sorteia 15 relíquias em cinco atos e garante pelo menos duas oportunidades de infusão. Antes do quinto ato, a corte vota entre Feira dos Fragmentos, Tribunal das Máscaras e Mercado dos Rostos Roubados. Vinte e nove figuras da Crônica vivem nos nomes, poderes, maldições, combos e objetivos do jogo; cada pessoa joga usando o próprio nome cadastrado.

O fluxo completo, as fórmulas de economia e Prestígio e a auditoria dos sistemas estão no [Mapa de Game Design](GAME_DESIGN_MAP.md).

## Desenvolvimento

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Produção

```bash
npm run build
npm run start
```

O projeto inclui `.shardcloud`. A aplicação de produção está conectada à branch `main` e recebe novos deploys pelos pushes do GitHub.

## Trilha sonora

**Apparitions Ball**, de Bobjt, disponibilizada em CC0/domínio público pelo OpenGameArt.
