# Paralelismo — O que pode ser feito em paralelo

Trilha 1: Infra + Repo (independente)
- estrutura monorepo + compose + CI

Trilha 2: Contratos críticos (independente de implementação)
- CARTAO_PONTO@v1
- ProcessJob v1
- Confidence Gate v1

Trilha 3: Modelo de dados
- migrations + seed
(depende só da Trilha 1)

Trilha 4: API Node
- endpoints + publisher do stream
(depende de Trilha 3)

Trilha 5: Worker Python
- consumer + pipeline v0/v1
(depende de Trilha 2 e Trilha 3; pode avançar junto da Trilha 4)

Trilha 6: Admin Console
- pode iniciar cedo com mocks e evoluir conforme API existir

Trilha 7: Templates reais + métricas
- começa após pipeline end-to-end básico estar pronto
