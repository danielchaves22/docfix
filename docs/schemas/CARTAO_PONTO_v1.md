# Schema: CARTAO_PONTO@v1 (Output canônico)

## 1) Objetivo
Extrair batidas de ponto por dia, com suporte a múltiplas entradas/saídas, preservando rastreabilidade e permitindo export colunar (Entrada1/Saída1/...) para Excel/CSV.

## 2) Decisão de formato canônico
- O JSON canônico será orientado a eventos (lista de batidas por dia).
- Export para Excel/CSV transforma em colunas fixas (Entrada1/Saída1/Entrada2/Saída2...).

Racional:
- JSON colunar é frágil e explode com variação do número de batidas.
- Lista de eventos é estável e auditável.
- Excel atende a necessidade do colunar sem sacrificar o core.

## 3) Estrutura do output (canônico)
### 3.1 Root
- schemaId: "CARTAO_PONTO"
- schemaVersion: 1
- jobId: UUID
- extractedAt: ISO-8601
- timezone: string (ex.: "America/Sao_Paulo") (opcional)
- employee (opcional no v1, mas recomendado se existir no documento):
  - name: string?
  - documentId: string? (CPF ou matrícula)  **(cuidado LGPD; pode ser opcional)**
  - employerName: string?
- period (opcional):
  - startDate: YYYY-MM-DD?
  - endDate: YYYY-MM-DD?
- days: Day[]
- summary (opcional):
  - totalDays: int
  - daysWithIssues: int

### 3.2 Day
- date: YYYY-MM-DD (obrigatório)
- punches: Punch[] (0..N)
- notes: string? (opcional)
- dayConfidence: 0..1 (opcional)
- issues: Issue[] (opcional)

### 3.3 Punch
- time: "HH:MM" (obrigatório)
- type: "IN" | "OUT" | "UNKNOWN" (obrigatório; UNKNOWN permitido no fallback)
- source:
  - page: int?
  - bbox: [x1,y1,x2,y2]? (opcional; para evidência)
  - textSnippet: string? (opcional; até ~50 chars)

### 3.4 Issue
- code: string (ex.: "INVALID_TIME", "OUT_BEFORE_IN", "TOO_MANY_PUNCHES")
- severity: "ERROR" | "WARN"
- message: string

## 4) Validações mínimas (para validationScore)
### 4.1 Formato e parsing
- date deve ser válida (calendário).
- time deve ser válida (00:00..23:59).

### 4.2 Coerência temporal por dia (heurística)
- se type está preenchido (IN/OUT), sequência esperada alternada (IN,OUT,IN,OUT...).
- se type está UNKNOWN, validar apenas ordenação crescente de horários.

### 4.3 Limites
- número de batidas por dia acima de um limite razoável gera WARN (ex.: > 10).
- tempos duplicados podem gerar WARN (dependendo do template).

## 5) Export colunar (Excel/CSV)
### 5.1 Colunas recomendadas
- Data
- Entrada 1, Saída 1, Entrada 2, Saída 2, Entrada 3, Saída 3, ...
- (opcional) Observações / Issues

### 5.2 Regra de preenchimento
- ordenar punches por time
- mapear alternância:
  - se type IN/OUT conhecido: mapear diretamente.
  - se UNKNOWN: preencher na ordem (Entrada1, Saída1, Entrada2...) e marcar issues.
- colunas extras além do máximo configurado:
  - gerar WARN e/ou mover excedente para coluna "Notas" (decisão de implementação).

## 6) Exemplo de output
```json
{
  "schemaId": "CARTAO_PONTO",
  "schemaVersion": 1,
  "jobId": "8a0c0d4d-0f3a-4a5f-a8f1-1f7c3d2a9b21",
  "extractedAt": "2026-02-20T12:34:56Z",
  "timezone": "America/Sao_Paulo",
  "employee": { "name": "Fulano de Tal", "employerName": "Empresa X" },
  "days": [
    {
      "date": "2026-02-01",
      "punches": [
        { "time": "08:02", "type": "IN",  "source": { "page": 1 } },
        { "time": "12:01", "type": "OUT", "source": { "page": 1 } },
        { "time": "13:00", "type": "IN",  "source": { "page": 1 } },
        { "time": "18:05", "type": "OUT", "source": { "page": 1 } }
      ],
      "issues": []
    }
  ]
}
```
