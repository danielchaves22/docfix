#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pythonCode = String.raw`
import datetime as dt
import json
import pathlib
import re
import sys
import uuid

try:
    import yaml
except Exception as exc:
    print(f"❌ Dependência ausente: pyyaml ({exc})", file=sys.stderr)
    sys.exit(1)

try:
    from jsonschema import Draft202012Validator, FormatChecker
except Exception as exc:
    print(f"❌ Dependência ausente: jsonschema ({exc})", file=sys.stderr)
    sys.exit(1)

contracts_root = pathlib.Path(sys.argv[1])
openapi_path = contracts_root / "openapi" / "openapi.yaml"
schemas_dir = contracts_root / "schemas"
examples_dir = contracts_root / "examples"

failures = []

def add_failure(area, message):
    failures.append((area, message))

def lint_openapi(doc):
    issues = []
    if not str(doc.get("openapi", "")).startswith("3."):
        issues.append('Campo "openapi" precisa iniciar em versão 3.x.')
    if not doc.get("info", {}).get("title"):
        issues.append("Campo obrigatório ausente: info.title")
    if not doc.get("info", {}).get("version"):
        issues.append("Campo obrigatório ausente: info.version")

    paths = doc.get("paths", {})
    if not isinstance(paths, dict) or len(paths) == 0:
        issues.append("Nenhum path definido em paths")

    methods = {"get", "post", "put", "patch", "delete", "options", "head", "trace"}
    for route, route_def in paths.items():
        if not isinstance(route_def, dict):
            continue
        for method, operation in route_def.items():
            if method not in methods or not isinstance(operation, dict):
                continue
            if not operation.get("summary"):
                issues.append(f"Operação {method.upper()} {route} sem summary")
            responses = operation.get("responses")
            if not isinstance(responses, dict) or len(responses) == 0:
                issues.append(f"Operação {method.upper()} {route} sem responses")
    return issues

def schema_key_from_filename(file_name):
    m = re.match(r"^(?P<name>.+)\.v(?P<version>\d+)\.schema\.json$", file_name)
    if not m:
        return None
    return f"{m.group('name').upper()}@{m.group('version')}"

def infer_schema_key_from_example_path(example_file):
    rel = example_file.relative_to(examples_dir)
    parts = rel.parts
    if len(parts) < 3:
        return None
    schema_name = parts[0]
    version_dir = parts[1]
    m = re.match(r"^v(\d+)$", version_dir)
    if not m:
        return None
    return f"{schema_name.upper()}@{m.group(1)}"

format_checker = FormatChecker()

@format_checker.checks("date")
def is_date(value):
    if not isinstance(value, str):
        return False
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", value):
        return False
    try:
        dt.date.fromisoformat(value)
        return True
    except ValueError:
        return False

@format_checker.checks("date-time")
def is_datetime(value):
    if not isinstance(value, str):
        return False
    if not re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$", value):
        return False
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        dt.datetime.fromisoformat(normalized)
        return True
    except ValueError:
        return False

@format_checker.checks("uuid")
def is_uuid(value):
    if not isinstance(value, str):
        return False
    try:
        uuid.UUID(value)
        return True
    except ValueError:
        return False

# 1) OpenAPI
try:
    with open(openapi_path, "r", encoding="utf-8") as f:
        openapi_doc = yaml.safe_load(f)
except Exception as exc:
    add_failure("openapi", f"Falha ao parsear OpenAPI: {exc}")
else:
    for issue in lint_openapi(openapi_doc or {}):
        add_failure("openapi", issue)
    if not [f for f in failures if f[0] == "openapi"]:
        print("✅ OpenAPI parse + lint básico concluído.")

# 2) Schemas
schema_index = {}
for schema_file in sorted(schemas_dir.glob("*.schema.json")):
    rel = schema_file.relative_to(contracts_root)
    try:
        schema_doc = json.loads(schema_file.read_text(encoding="utf-8"))
    except Exception as exc:
        add_failure("schemas", f"Falha de parse em {rel}: {exc}")
        continue

    if schema_doc.get("$schema") != "https://json-schema.org/draft/2020-12/schema":
        add_failure("schemas", f"{rel} não declara $schema draft 2020-12")
        continue

    try:
        Draft202012Validator.check_schema(schema_doc)
    except Exception as exc:
        add_failure("schemas", f"Schema inválido no metaschema 2020-12 ({rel}): {exc}")
        continue

    schema_id = schema_doc.get("properties", {}).get("schemaId", {}).get("const")
    schema_version = schema_doc.get("properties", {}).get("schemaVersion", {}).get("const")
    key = f"{schema_id}@{schema_version}" if isinstance(schema_id, str) and isinstance(schema_version, int) else schema_key_from_filename(schema_file.name)

    if not key:
        add_failure("schemas", f"Não foi possível inferir schemaId/schemaVersion em {rel}")
        continue
    if key in schema_index:
        add_failure("schemas", f"Schema duplicado para chave {key} ({rel})")
        continue

    schema_index[key] = (schema_doc, rel)

if schema_index and not [f for f in failures if f[0] == "schemas"]:
    print("✅ JSON Schemas parseados e validados contra metaschema 2020-12.")

# 3) Examples

def collect_examples(folder_name):
    return sorted(examples_dir.glob(f"**/{folder_name}/*.json"))

def run_example_validation(files, should_pass):
    for file in files:
        rel = file.relative_to(contracts_root)
        try:
            instance = json.loads(file.read_text(encoding="utf-8"))
        except Exception as exc:
            add_failure("examples", f"Falha de parse em {rel}: {exc}")
            continue

        explicit_key = f"{instance.get('schemaId')}@{instance.get('schemaVersion')}"
        fallback_key = infer_schema_key_from_example_path(file)
        schema_data = schema_index.get(explicit_key) or (schema_index.get(fallback_key) if fallback_key else None)

        if not schema_data:
            add_failure("examples", f"Schema não encontrado para {rel}. Esperado: {explicit_key} ou {fallback_key}")
            continue

        schema_doc, schema_rel = schema_data
        validator = Draft202012Validator(schema_doc, format_checker=format_checker)
        errors = sorted(validator.iter_errors(instance), key=lambda e: e.json_path)

        if should_pass and errors:
            msg = "; ".join([f"{e.json_path}: {e.message}" for e in errors])
            add_failure("examples", f"Exemplo válido reprovado ({rel}) contra {schema_rel}: {msg}")
        if not should_pass and not errors:
            add_failure("examples", f"Exemplo inválido passou indevidamente ({rel})")

run_example_validation(collect_examples("valid"), True)
run_example_validation(collect_examples("invalid"), False)

if not [f for f in failures if f[0] == "examples"]:
    print("✅ Exemplos valid/invalid validados com sucesso.")

if failures:
    print("\n❌ Falhas encontradas na validação de contracts:", file=sys.stderr)
    for area, message in failures:
        print(f"- [{area}] {message}", file=sys.stderr)
    sys.exit(1)

print("\n✅ Contracts validados com sucesso.")
`;

const result = spawnSync('python', ['-c', pythonCode, path.resolve(__dirname, '..')], {
  encoding: 'utf-8',
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.error) {
  console.error('❌ Falha ao executar o validador Python:', result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
