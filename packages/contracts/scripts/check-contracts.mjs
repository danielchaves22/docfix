#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const contractsRoot = path.resolve(__dirname, '..');

const OPENAPI_PATH = path.join(contractsRoot, 'openapi', 'openapi.yaml');
const SCHEMAS_DIR = path.join(contractsRoot, 'schemas');
const EXAMPLES_DIR = path.join(contractsRoot, 'examples');

const failures = [];

function addFailure(area, message) {
  failures.push({ area, message });
}

async function collectFilesBySuffix(dirPath, suffix) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFilesBySuffix(fullPath, suffix)));
    } else if (entry.isFile() && entry.name.endsWith(suffix)) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

async function collectExampleFiles(rootDir, folderName) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (!entry.isDirectory()) continue;

    if (entry.name === folderName) {
      files.push(...(await collectFilesBySuffix(fullPath, '.json')));
      continue;
    }

    files.push(...(await collectExampleFiles(fullPath, folderName)));
  }

  return files.sort();
}

function parseYamlWithRuby(filePath) {
  const rubyCode = `
    require 'yaml'
    require 'json'
    doc = YAML.safe_load(File.read(ARGV[0]), aliases: true)
    puts JSON.generate(doc)
  `;

  const output = execFileSync('ruby', ['-e', rubyCode, filePath], { encoding: 'utf-8' });
  return JSON.parse(output);
}

function lintOpenApi(doc) {
  const issues = [];
  if (!doc.openapi || !String(doc.openapi).startsWith('3.')) {
    issues.push('Campo openapi ausente ou fora da versão 3.x.');
  }
  if (!doc.info?.title) issues.push('Campo obrigatório ausente: info.title.');
  if (!doc.info?.version) issues.push('Campo obrigatório ausente: info.version.');
  if (!doc.paths || Object.keys(doc.paths).length === 0) issues.push('Nenhum path definido em paths.');

  const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'];
  for (const [route, routeDef] of Object.entries(doc.paths ?? {})) {
    for (const method of methods) {
      const operation = routeDef?.[method];
      if (!operation) continue;
      if (!operation.summary) issues.push(`Operação ${method.toUpperCase()} ${route} sem summary.`);
      if (!operation.responses || Object.keys(operation.responses).length === 0) {
        issues.push(`Operação ${method.toUpperCase()} ${route} sem responses.`);
      }
    }
  }

  return issues;
}

function keyFromFileName(fileName) {
  const match = fileName.match(/^(?<name>.+)\.v(?<version>\d+)\.schema\.json$/);
  if (!match?.groups) return null;
  return `${match.groups.name.toUpperCase()}@${match.groups.version}`;
}

function resolveRef(rootSchema, ref) {
  if (!ref.startsWith('#/')) return null;
  const parts = ref.slice(2).split('/').map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
  let node = rootSchema;
  for (const part of parts) {
    if (node && typeof node === 'object' && part in node) {
      node = node[part];
    } else {
      return null;
    }
  }
  return node;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidDate(value) {
  if (typeof value !== 'string') return false;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

function isValidDateTime(value) {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed);
}

function validateInstance(instance, schema, rootSchema, instancePath = '$') {
  let currentSchema = schema;
  if (currentSchema?.$ref) {
    const resolved = resolveRef(rootSchema, currentSchema.$ref);
    if (!resolved) {
      return [{ path: instancePath, message: `Referência não resolvida: ${currentSchema.$ref}` }];
    }
    currentSchema = resolved;
  }

  const errors = [];

  if (Object.prototype.hasOwnProperty.call(currentSchema ?? {}, 'const') && instance !== currentSchema.const) {
    errors.push({ path: instancePath, message: `deve ser constante ${JSON.stringify(currentSchema.const)}` });
    return errors;
  }

  if (currentSchema?.enum && !currentSchema.enum.includes(instance)) {
    errors.push({ path: instancePath, message: `deve estar em enum ${JSON.stringify(currentSchema.enum)}` });
  }

  if (currentSchema?.type) {
    const expected = currentSchema.type;
    const typeOk =
      (expected === 'object' && isObject(instance)) ||
      (expected === 'array' && Array.isArray(instance)) ||
      (expected === 'string' && typeof instance === 'string') ||
      (expected === 'number' && typeof instance === 'number') ||
      (expected === 'integer' && Number.isInteger(instance)) ||
      (expected === 'boolean' && typeof instance === 'boolean') ||
      (expected === 'null' && instance === null);

    if (!typeOk) {
      errors.push({ path: instancePath, message: `tipo inválido: esperado ${expected}` });
      return errors;
    }
  }

  if (typeof instance === 'number') {
    if (typeof currentSchema?.minimum === 'number' && instance < currentSchema.minimum) {
      errors.push({ path: instancePath, message: `deve ser >= ${currentSchema.minimum}` });
    }
    if (typeof currentSchema?.maximum === 'number' && instance > currentSchema.maximum) {
      errors.push({ path: instancePath, message: `deve ser <= ${currentSchema.maximum}` });
    }
  }

  if (typeof instance === 'string') {
    if (typeof currentSchema?.maxLength === 'number' && instance.length > currentSchema.maxLength) {
      errors.push({ path: instancePath, message: `tamanho máximo ${currentSchema.maxLength}` });
    }
    if (typeof currentSchema?.pattern === 'string') {
      const regex = new RegExp(currentSchema.pattern);
      if (!regex.test(instance)) {
        errors.push({ path: instancePath, message: `não atende ao pattern ${currentSchema.pattern}` });
      }
    }
    if (currentSchema?.format === 'date' && !isValidDate(instance)) {
      errors.push({ path: instancePath, message: 'format date inválido' });
    }
    if (currentSchema?.format === 'date-time' && !isValidDateTime(instance)) {
      errors.push({ path: instancePath, message: 'format date-time inválido' });
    }
    if (currentSchema?.format === 'uuid' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(instance)) {
      errors.push({ path: instancePath, message: 'format uuid inválido' });
    }
  }

  if (Array.isArray(instance)) {
    if (typeof currentSchema?.minItems === 'number' && instance.length < currentSchema.minItems) {
      errors.push({ path: instancePath, message: `mínimo de itens ${currentSchema.minItems}` });
    }
    if (typeof currentSchema?.maxItems === 'number' && instance.length > currentSchema.maxItems) {
      errors.push({ path: instancePath, message: `máximo de itens ${currentSchema.maxItems}` });
    }
    if (currentSchema?.items) {
      instance.forEach((item, index) => {
        errors.push(...validateInstance(item, currentSchema.items, rootSchema, `${instancePath}/${index}`));
      });
    }
  }

  if (isObject(instance)) {
    for (const requiredKey of currentSchema?.required ?? []) {
      if (!Object.prototype.hasOwnProperty.call(instance, requiredKey)) {
        errors.push({ path: `${instancePath}/${requiredKey}`, message: 'propriedade obrigatória ausente' });
      }
    }

    const properties = currentSchema?.properties ?? {};
    if (currentSchema?.additionalProperties === false) {
      for (const key of Object.keys(instance)) {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) {
          errors.push({ path: `${instancePath}/${key}`, message: 'propriedade adicional não permitida' });
        }
      }
    }

    for (const [key, propertySchema] of Object.entries(properties)) {
      if (Object.prototype.hasOwnProperty.call(instance, key)) {
        errors.push(...validateInstance(instance[key], propertySchema, rootSchema, `${instancePath}/${key}`));
      }
    }
  }

  return errors;
}

async function validateOpenApi() {
  try {
    const doc = parseYamlWithRuby(OPENAPI_PATH);
    const issues = lintOpenApi(doc);
    issues.forEach((issue) => addFailure('openapi', issue));
    if (issues.length === 0) {
      console.log('✅ OpenAPI parseado e lint básico concluído.');
    }
  } catch (error) {
    addFailure('openapi', `Falha de parse/validação do OpenAPI: ${error.message}`);
  }
}

async function loadSchemas() {
  const schemaFiles = await collectFilesBySuffix(SCHEMAS_DIR, '.schema.json');
  const schemaIndex = new Map();

  for (const filePath of schemaFiles) {
    const relPath = path.relative(contractsRoot, filePath);
    let schemaDoc;
    try {
      schemaDoc = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    } catch (error) {
      addFailure('schemas', `Falha de parse em ${relPath}: ${error.message}`);
      continue;
    }

    if (schemaDoc.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
      addFailure('schemas', `${relPath} não declara $schema draft 2020-12.`);
      continue;
    }

    const schemaIdConst = schemaDoc?.properties?.schemaId?.const;
    const schemaVersionConst = schemaDoc?.properties?.schemaVersion?.const;
    const fallbackKey = keyFromFileName(path.basename(filePath));
    const schemaKey = typeof schemaIdConst === 'string' && Number.isInteger(schemaVersionConst)
      ? `${schemaIdConst}@${schemaVersionConst}`
      : fallbackKey;

    if (!schemaKey) {
      addFailure('schemas', `Não foi possível inferir chave do schema em ${relPath}.`);
      continue;
    }

    schemaIndex.set(schemaKey, schemaDoc);
  }

  if (schemaFiles.length > 0 && failures.every((f) => f.area !== 'schemas')) {
    console.log('✅ JSON Schemas parseados e identificados como draft 2020-12.');
  }

  return schemaIndex;
}

function formatErrors(errors) {
  return errors.map((error) => `${error.path}: ${error.message}`).join('; ');
}

async function validateExamples(schemaIndex) {
  const validFiles = await collectExampleFiles(EXAMPLES_DIR, 'valid');
  const invalidFiles = await collectExampleFiles(EXAMPLES_DIR, 'invalid');

  for (const filePath of validFiles) {
    const relPath = path.relative(contractsRoot, filePath);
    let data;
    try {
      data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    } catch (error) {
      addFailure('examples', `Falha de parse em ${relPath}: ${error.message}`);
      continue;
    }

    const schemaKey = `${data?.schemaId}@${data?.schemaVersion}`;
    const schema = schemaIndex.get(schemaKey);
    if (!schema) {
      addFailure('examples', `Schema não encontrado para ${relPath}. Esperado ${schemaKey}.`);
      continue;
    }

    const errors = validateInstance(data, schema, schema);
    if (errors.length > 0) {
      addFailure('examples', `Exemplo válido reprovado (${relPath}): ${formatErrors(errors)}`);
    }
  }

  for (const filePath of invalidFiles) {
    const relPath = path.relative(contractsRoot, filePath);
    let data;
    try {
      data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    } catch (error) {
      addFailure('examples', `Falha de parse em ${relPath}: ${error.message}`);
      continue;
    }

    const schemaKey = `${data?.schemaId}@${data?.schemaVersion}`;
    const schema = schemaIndex.get(schemaKey);
    if (!schema) {
      continue;
    }

    const errors = validateInstance(data, schema, schema);
    if (errors.length === 0) {
      addFailure('examples', `Exemplo inválido passou indevidamente (${relPath}).`);
    }
  }

  if (failures.every((f) => f.area !== 'examples')) {
    console.log('✅ Exemplos valid/invalid validados com sucesso.');
  }
}

async function main() {
  await validateOpenApi();
  const schemaIndex = await loadSchemas();
  await validateExamples(schemaIndex);

  if (failures.length > 0) {
    console.error('\n❌ Falhas encontradas na validação de contracts:');
    for (const failure of failures) {
      console.error(`- [${failure.area}] ${failure.message}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('\n✅ Contracts validados com sucesso.');
}

main().catch((error) => {
  console.error('❌ Erro inesperado:', error);
  process.exit(1);
});
