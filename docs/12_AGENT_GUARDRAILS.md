# Guardrails para Agentes (obrigatório)

Cole este bloco no início de qualquer prompt de implementação:

```text
Obrigatório seguir `docs/11_TECH_STACK_BASELINE.md`:
- Migrations: node-pg-migrate em services/api/migrations (API executa; worker não executa).
- Node/API: Kysely (preferencial) ou pg com SQL explícito. Evitar Prisma/TypeORM no MVP.
- Python/Worker: psycopg v3 ou SQLAlchemy Core (sem ORM).
Se sua solução violar isso, pare e proponha alternativa com justificativa.
```
