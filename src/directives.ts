import { GraphQLObjectType, ArgumentNode, DirectiveNode } from 'graphql';
import {
  CypherConditionalStatement,
  DirectiveNames,
  CypherDirectiveArgs,
  RelationshipDirection,
} from './types';
import uuid from 'uuid';
import { valueNodeToValue, extractObjectType } from './graphql';
import { path } from 'ramda';

const getNamedArg = (
  directive: DirectiveNode,
  argName: string
): ArgumentNode | null => {
  const argument =
    directive.arguments &&
    directive.arguments.find(arg => arg.name.value === argName);

  return argument || null;
};

/** Returns an argument value as a string. Works with enums. */
export const extractArgumentStringValue = (
  directive: DirectiveNode,
  argName: string
): string | undefined => {
  const argument = getNamedArg(directive, argName);
  if (!argument) {
    return undefined;
  }

  const value = argument.value;
  if (value.kind !== 'StringValue' && value.kind !== 'EnumValue') {
    return undefined;
  }
  return value.value;
};

const coerceToArray = (str?: string) => (str ? [str] : undefined);

export const extractArgumentArrayValue = (
  directive: DirectiveNode,
  argName: string
): string[] => {
  const argument = getNamedArg(directive, argName);
  if (!argument) {
    return [];
  }

  const value = argument.value;
  if (value.kind !== 'ListValue') {
    return [];
  }
  return value.values
    .map(valueNode => {
      if (valueNode.kind !== 'StringValue') {
        return null;
      }
      return valueNode.value;
    })
    .filter(Boolean) as string[];
};

export const extractArgumentBooleanValue = (
  directive: DirectiveNode,
  argName: string
): boolean | undefined => {
  const argument = getNamedArg(directive, argName);
  if (!argument) {
    return undefined;
  }

  const value = argument.value;
  if (value.kind !== 'BooleanValue') {
    return undefined;
  }
  return value.value;
};

export const isCypherSkip = (
  schemaType: GraphQLObjectType,
  fieldName: string,
  directiveName: string = 'cypherSkip'
) => {
  const field = schemaType.getFields()[fieldName];
  if (!field || !field.astNode) {
    return false;
  }

  return (
    field.astNode.directives &&
    field.astNode.directives.some(
      directive => directive.name.value === directiveName
    )
  );
};

export const getGeneratedArgsFromDirectives = (
  schemaType: GraphQLObjectType,
  fieldName: string,
  generateIdDirectiveName: string = 'generateId'
): { [name: string]: any } | null => {
  const field = schemaType.getFields()[fieldName];
  if (!field || !field.astNode) {
    return [];
  }

  const generateIdDirective = field.astNode.directives
    ? field.astNode.directives.find(
        directive => directive.name.value === generateIdDirectiveName
      )
    : null;

  if (!generateIdDirective) {
    return null;
  }

  const generatedIdArgName =
    extractArgumentStringValue(generateIdDirective, 'argName') || 'id';

  return {
    [generatedIdArgName]: uuid(),
  };
};

export const getMatchingConditionalCypher = (
  cypherDirectives: CypherConditionalStatement[],
  args: { [key: string]: any },
  fieldName: string,
  directiveName: string = 'cypherCustom'
): CypherConditionalStatement => {
  for (let directive of cypherDirectives) {
    if (!directive.when) {
      return directive;
    }

    const pathSegments = directive.when
      .replace('$', '')
      .split('.')
      .map(segment => {
        if (segment.startsWith('[') && segment.endsWith(']')) {
          return parseInt(segment.replace('[', '').replace(']', ''), 10);
        }
        return segment;
      });

    const pathValue = path(pathSegments, { args });

    if (!!pathValue) {
      return directive;
    }
  }

  throw new Error(
    `No @${directiveName} directive matched on field ${fieldName}. Always supply a directive without a condition!`
  );
};

export const getNamedFieldDirective = ({
  schemaType,
  fieldName,
  directiveName,
}: {
  schemaType: GraphQLObjectType;
  fieldName: string;
  directiveName: string;
}) => {
  const field = schemaType.getFields()[fieldName];
  if (!field || !field.astNode || !field.astNode.directives) {
    return null;
  }

  return field.astNode.directives.find(dir => dir.name.value === directiveName);
};

export const getNamedReturnTypeDirective = ({
  schemaType,
  fieldName,
  directiveName,
}: {
  schemaType: GraphQLObjectType;
  fieldName: string;
  directiveName: string;
}) => {
  const field = schemaType.getFields()[fieldName];
  if (!field || !field.type) {
    return null;
  }

  const objectType = extractObjectType(field.type);

  if (!objectType || !objectType.astNode || !objectType.astNode.directives) {
    return null;
  }

  return objectType.astNode.directives.find(
    dir => dir.name.value === directiveName
  );
};

const isRelationshipDirection = (str: string): str is RelationshipDirection =>
  ['IN', 'OUT'].includes(str);

export const getCypherDirective = ({
  schemaType,
  fieldName,
  directiveNames,
  args,
}: {
  schemaType: GraphQLObjectType;
  fieldName: string;
  directiveNames: DirectiveNames;
  args: { [name: string]: any };
}): CypherDirectiveArgs | null => {
  const directives: DirectiveNode[] = [
    directiveNames.cypher,
    directiveNames.cypherNode,
    directiveNames.cypherRelationship,
    directiveNames.cypherCustom,
    directiveNames.cypherLinkedNodes,
  ]
    .map(directiveName =>
      getNamedFieldDirective({ schemaType, fieldName, directiveName })
    )
    .filter(Boolean) as DirectiveNode[];

  if (directives.length === 0) {
    // check for a 'virtual' directive on the return type of the field, if so
    // it's a virtual field.
    const virtualDirective = getNamedReturnTypeDirective({
      schemaType,
      fieldName,
      directiveName: directiveNames.cypherVirtual,
    });

    if (virtualDirective) {
      return {
        kind: 'CypherVirtualDirective',
      };
    } else {
      return null;
    }
  } else if (directives.length > 1) {
    throw new Error(
      `Multiple Cypher directives are not allowed on the same field (type "${
        schemaType.name
      }", field "${fieldName}"`
    );
  }

  const directive = directives[0];
  const directiveArguments = directive.arguments || [];

  if (directive.name.value === directiveNames.cypherCustom) {
    const statement = extractArgumentStringValue(directive, 'statement');
    const returnsRelationship = !!extractArgumentBooleanValue(
      directive,
      'returnsRelationship'
    );

    if (statement) {
      return {
        kind: 'CypherCustomDirective',
        cypher: statement,
        returnsRelationship,
      };
    }

    const statementsArg = directiveArguments.find(
      arg => arg.name.value === 'statements'
    );

    if (!statementsArg) {
      throw new Error(
        `@${
          directiveNames.cypherCustom
        } directive on '${fieldName}' must specify either 'statement' or 'statements' argument`
      );
    }

    const statements = valueNodeToValue(statementsArg.value, {}).map(item => ({
      ...item,
      statement: item.statement.trim(),
    }));

    const matching = getMatchingConditionalCypher(
      statements,
      args,
      fieldName,
      directiveNames.cypherCustom
    );

    return {
      kind: 'CypherCustomDirective',
      cypher: matching.statement,
      returnsRelationship,
    };
  } else if (directive.name.value === directiveNames.cypher) {
    const match = extractArgumentStringValue(directive, 'match');
    const optionalMatch = extractArgumentStringValue(
      directive,
      'optionalMatch'
    );
    const create =
      coerceToArray(extractArgumentStringValue(directive, 'create')) ||
      extractArgumentArrayValue(directive, 'createMany');
    const merge =
      coerceToArray(extractArgumentStringValue(directive, 'merge')) ||
      extractArgumentArrayValue(directive, 'mergeMany');
    const set =
      coerceToArray(extractArgumentStringValue(directive, 'set')) ||
      extractArgumentArrayValue(directive, 'setMany');
    const del =
      coerceToArray(extractArgumentStringValue(directive, 'delete')) ||
      extractArgumentArrayValue(directive, 'deleteMany');
    const detachDelete =
      coerceToArray(extractArgumentStringValue(directive, 'detachDelete')) ||
      extractArgumentArrayValue(directive, 'detachDeleteMany');
    const remove =
      coerceToArray(extractArgumentStringValue(directive, 'remove')) ||
      extractArgumentArrayValue(directive, 'removeMany');
    const orderBy = extractArgumentStringValue(directive, 'orderBy');
    const skip = extractArgumentStringValue(directive, 'skip');
    const limit = extractArgumentStringValue(directive, 'limit');
    const ret = extractArgumentStringValue(directive, 'return');

    if (!ret) {
      throw new Error(
        `\`return\` argument is required on a @${
          directiveNames.cypher
        } directive (type: "${schemaType.name}", field: "${fieldName}")`
      );
    }

    return {
      kind: 'CypherBuilderDirective',
      match,
      optionalMatch,
      create,
      merge,
      set,
      delete: del,
      detachDelete,
      remove,
      orderBy,
      skip,
      limit,
      return: ret,
    };
  } else if (directive.name.value === directiveNames.cypherNode) {
    const relationship = extractArgumentStringValue(directive, 'relationship');
    const direction = extractArgumentStringValue(directive, 'direction');
    const label = extractArgumentStringValue(directive, 'label');
    const where = extractArgumentStringValue(directive, 'where');

    if (!relationship || !direction || !isRelationshipDirection(direction)) {
      throw new Error(
        `A @${
          directiveNames.cypherNode
        } directive requires \`relationship\` and \`direction\` arguments, and \`direction\` must be "IN" or "OUT" (type: "${
          schemaType.name
        }", field: "${fieldName}")`
      );
    }

    return {
      kind: 'CypherNodeDirective',
      relationship,
      direction,
      label,
      where,
    };
  } else if (directive.name.value === directiveNames.cypherRelationship) {
    const relationshipType = extractArgumentStringValue(directive, 'type');
    const direction = extractArgumentStringValue(directive, 'direction');
    const nodeLabel = extractArgumentStringValue(directive, 'nodeLabel');
    const where = extractArgumentStringValue(directive, 'where');

    if (
      !relationshipType ||
      !direction ||
      !isRelationshipDirection(direction)
    ) {
      throw new Error(
        `A @${
          directiveNames.cypherRelationship
        } directive requires \`type\` and \`direction\` arguments, and \`direction\` must be "IN" or "OUT" (type: "${
          schemaType.name
        }", field: "${fieldName}")`
      );
    }

    return {
      kind: 'CypherRelationshipDirective',
      relationshipType,
      direction,
      nodeLabel,
      where,
    };
  } else if (directive.name.value === directiveNames.cypherLinkedNodes) {
    const relationship = extractArgumentStringValue(directive, 'relationship');
    const direction =
      extractArgumentStringValue(directive, 'direction') || 'OUT';
    const label = extractArgumentStringValue(directive, 'label');
    const where = extractArgumentStringValue(directive, 'where');
    const skip = extractArgumentStringValue(directive, 'skip');
    const limit = extractArgumentStringValue(directive, 'limit');

    if (!relationship) {
      throw new Error(
        `A @${
          directiveNames.cypherLinkedNodes
        } directive requires \`relationship\` (type: "${
          schemaType.name
        }", field: "${fieldName}")`
      );
    }

    return {
      kind: 'CypherLinkedNodesDirective',
      relationship,
      direction: direction as RelationshipDirection,
      label,
      where,
      skip,
      limit,
    };
  } else if (directive.name.value === directiveNames.cypherComputed) {
    const value = extractArgumentStringValue(directive, 'value');

    if (!value) {
      throw new Error(
        `A @${
          directiveNames.cypherComputed
        } directive requires \`value\` (type: "${
          schemaType.name
        }", field: "${fieldName}")`
      );
    }

    return {
      kind: 'CypherComputedDirective',
      value,
    };
  }

  return null;
};

export const findCypherNodesDirectiveOnType = ({
  schemaType,
  directiveNames,
}: {
  schemaType: GraphQLObjectType;
  directiveNames: DirectiveNames;
}): {
  fieldName: string;
  directive: DirectiveNode;
}[] => {
  const fields = schemaType.getFields();
  const nodeDirectives = Object.keys(fields)
    .map(fieldName => ({
      fieldName,
      directive: getNamedFieldDirective({
        schemaType,
        fieldName,
        directiveName: directiveNames.cypherNode,
      }),
    }))
    .filter(({ directive }) => !!directive) as {
    fieldName: string;
    directive: DirectiveNode;
  }[];

  return nodeDirectives;
};
