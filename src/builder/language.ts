import { RelationshipDirection } from '../types';
import { FIELD_PARAM_PREFIX } from './constants';

export const escapeQuotes = (string: string) => string.replace(/"/g, '\\"');

export const safeVar = (v: any) => {
  const stringified = `${v}`;
  // https://neo4j.com/docs/developer-manual/current/cypher/syntax/naming/
  return stringified.replace(/[-!$%^&*()_+|~=`{}\[\]:";'<>?,.\/]/g, '_');
};

export const buildMatch = (phrase?: string) => phrase && `MATCH ${phrase}`;

export const buildOptionalMatch = (phrase?: string) =>
  phrase && `OPTIONAL MATCH ${phrase}`;

export const buildWhere = (phrase?: string) => phrase && `WHERE ${phrase}`;

export const buildCreate = (phrase?: string) => phrase && `CREATE ${phrase}`;

export const buildMerge = (phrase?: string) => phrase && `MERGE ${phrase}`;

export const buildSet = (phrase?: string) => phrase && `SET ${phrase}`;

export const buildDelete = (phrase?: string) => phrase && `DELETE ${phrase}`;

export const buildRemove = (phrase?: string) => phrase && `REMOVE ${phrase}`;

export const buildDetachDelete = (phrase?: string) =>
  phrase && `DETACH DELETE ${phrase}`;

export const buildOrderBy = (phrase?: string) => phrase && `ORDER BY ${phrase}`;

export const buildSkip = (count?: string) => count && `SKIP ${count}`;

export const buildLimit = (count?: string) => count && `LIMIT ${count}`;

export const buildWith = (phrase?: string) => phrase && `WITH ${phrase}`;

export const buildReturn = (value: string): string => `RETURN ${value}`;

export const buildFilters = ({
  orderBy,
  skip,
  limit,
}: {
  orderBy: string | undefined;
  skip: string | undefined;
  limit: string | undefined;
}) =>
  (orderBy || skip || limit) &&
  [buildOrderBy(orderBy), buildSkip(skip), buildLimit(limit)]
    .filter(Boolean)
    .join(' ');

export const buildPhrases = (phrases: (string | undefined)[]) =>
  phrases.filter(Boolean).join('\n');

export const buildBindable = ({
  openChar,
  closeChar,
  binding,
  label,
  properties,
  extra,
}: {
  openChar: string;
  closeChar: string;
  binding?: string;
  label?: string;
  properties?: {
    [key: string]: string | number | boolean;
  };
  extra?: string;
}) => {
  const propertiesString =
    properties &&
    Object.keys(properties)
      .map(key => `${key}: ${properties[key]}`)
      .join(', ');
  return `${openChar}${binding || ''}${label ? `:${label}` : ''}${
    propertiesString ? `{${propertiesString}}` : ''
  }${extra ? extra : ''}${closeChar}`;
};

export const buildNode = ({
  binding,
  label,
  properties,
}: {
  binding?: string;
  label?: string;
  properties?: { [key: string]: string | number | boolean };
}) =>
  buildBindable({ binding, label, properties, openChar: '(', closeChar: ')' });

export const buildRelationship = ({
  binding,
  label,
  properties,
  direction,
  variableLength,
  sliceStart = null,
  sliceEnd = null,
}: {
  binding?: string;
  label?: string;
  properties?: { [key: string]: string | number | boolean };
  direction: RelationshipDirection;
  variableLength?: boolean;
  sliceStart?: number | null;
  sliceEnd?: number | null;
}) => {
  const variableLengthSection = variableLength
    ? `*${sliceStart !== null ? sliceStart : ''}${
        sliceStart !== null || sliceEnd !== null ? '..' : ''
      }${sliceEnd !== null ? sliceEnd : ''}`
    : '';

  const body = buildBindable({
    binding,
    label,
    properties,
    openChar: '[',
    closeChar: ']',
    extra: variableLengthSection,
  });

  if (direction === 'IN') {
    return `<-${body}-`;
  } else {
    return `-${body}->`;
  }
};

export const buildMultiValueYieldMapper = ({
  returnNames,
}: {
  returnNames: string[];
}) => {
  const yieldedNames = returnNames
    .map(
      (name, idx) =>
        `apoc.map.values(value, [keys(value)[${idx}]])[0] AS \`${name}\``
    )
    .join(', ');

  return 'YIELD value ' + `WITH ${yieldedNames}`;
};

/**
 * Returns a function that will process a phrase and replace the specified argument
 * names with 'namespaced' versions for use in a real query
 */
export const createParamNamespacer = (
  namespace: string,
  paramNames: string[] = ['args', 'generated', 'virtual']
) => (phrase?: string) =>
  phrase &&
  paramNames.reduce(
    (output, argName) =>
      output.replace(
        new RegExp(`\\$${argName}`, 'g'),
        `$${FIELD_PARAM_PREFIX}${namespace}.${argName}`
      ),
    phrase
  );

const nameRegex = '((\\w+)|(`[\\w\\s$!?+-@#%^&*()]+`))';
const extractBindingRegex = `[\\(\\[]${nameRegex}(:.+?)?[\\)\\]]`;
export const getBindings = (clause: string): string[] => {
  // JS regexp searching is a mess...
  const bindings: Set<string> = new Set();
  const matcher = new RegExp(extractBindingRegex, 'g');
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(clause))) {
    bindings.add(match[1]);
  }
  return Array.from(bindings);
};

/**
 * Renames any usage of (parent) or parent.foo with a new
 * binding name for the parent.
 */
export const renameParentBoundNode = (phrase: string, newParentName: string) =>
  phrase
    .replace(/\(parent\)/g, `(${newParentName})`)
    .replace(/\Wparent./g, `(${newParentName})`);
