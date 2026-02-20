# Confidence Gate — Score, validação e status

## 1) Objetivo
Evitar erro silencioso. O sistema só marca `DONE` (AUTO_OK) quando a confiança passa um limiar.
Caso contrário: `NEEDS_REVIEW`.

## 2) Componentes do score
O score final deve ser determinístico (reprodutível), baseado em:

A) detectorScore (0..1)
- confiança do detector de template (fingerprint, anchors, etc.)

B) validationScore (0..1)
- quão bem o output atende validações do schema
- penaliza erros; warnings penalizam menos

C) completenessScore (0..1)
- proporção de campos/dias/entradas extraídas vs esperadas (quando aplicável)
- schema define o que é obrigatório vs opcional

## 3) Fórmula recomendada (v1)
scoreFinal = 0.35*detectorScore + 0.50*validationScore + 0.15*completenessScore

Racional:
- validação pesa mais do que detector.
- completude é importante, mas não pode “falsificar” consistência.

## 4) Thresholds
- threshold por schema (config):
  - `CARTAO_PONTO@v1`: 0.85 (recomendado no começo)
- templates instáveis podem exigir threshold maior futuramente.

## 5) Status resultante
- se scoreFinal >= threshold => status = DONE (AUTO_OK)
- senão => status = NEEDS_REVIEW (entrega resultado + relatório + evidências)

## 6) Validation report (obrigatório)
Estrutura recomendada:
- errors[]: lista de violações que comprometem o dado (ex.: horário inválido)
- warnings[]: possíveis problemas (ex.: dia com número incomum de batidas)
- fieldConfidences: mapa campo→0..1 (quando aplicável)
- notes: observações para operador/console

## 7) Ajustes manuais e métricas
Quando houver revisão humana:
- registrar job_review (campos alterados e intensidade)
- isso retroalimenta métricas do template (confiabilidade).
