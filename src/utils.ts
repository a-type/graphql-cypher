import {
  GraphQLScalarType,
  GraphQLNamedType,
  GraphQLResolveInfo,
  ResponsePath,
  GraphQLObjectType,
  GraphQLInterfaceType,
  FieldNode,
  SelectionSetNode,
  GraphQLSchema,
  ArgumentNode,
  ValueNode,
  NameNode,
  FragmentDefinitionNode,
  InlineFragmentNode,
  FragmentSpreadNode,
  GraphQLOutputType,
  GraphQLNonNull,
  GraphQLList,
  isListType,
  isNonNullType,
  isObjectType,
  isInterfaceType,
  isInputObjectType,
  isUnionType,
} from 'graphql';
import { CypherConditionalStatement } from './types';
import uuid from 'uuid';

export function isGraphqlScalarType(
  type: GraphQLNamedType
): type is GraphQLScalarType {
  return !(
    type instanceof GraphQLObjectType || type instanceof GraphQLInterfaceType
  );
}

export function isArrayType(type: GraphQLNamedType) {
  return type ? type.toString().startsWith('[') : false;
}

export function isRoot(info: GraphQLResolveInfo): boolean {
  return [info.schema.getQueryType(), info.schema.getMutationType()]
    .filter(Boolean)
    .some(rootType => !!rootType && rootType.name === info.parentType.name);
}

/**
 * Converts a path from `info` into a field path, skipping over
 * array indices (since they are not represented in the schema
 * field selection paths)
 */
export function getFieldPath(info: GraphQLResolveInfo) {
  const path: string[] = [];
  let pathLink: ResponsePath | undefined = info.path;
  while (pathLink) {
    if (typeof pathLink.key === 'string') {
      path.unshift(pathLink.key);
    }
    pathLink = pathLink.prev;
  }

  return path;
}

export const extractArgumentStringValue = (
  argument?: ArgumentNode | null
): string | null => {
  if (!argument) {
    return null;
  }

  const value = argument.value;
  if (value.kind !== 'StringValue') {
    return null;
  }
  return value.value;
};

export const getCypherStatementsFromDirective = (
  schemaType: GraphQLObjectType,
  fieldName: string
): CypherConditionalStatement[] => {
  const field = schemaType.getFields()[fieldName];
  if (!field || !field.astNode) {
    return [];
  }

  const cypherDirective = field.astNode.directives
    ? field.astNode.directives.find(
        directive => directive.name.value === 'cypher'
      )
    : null;

  if (!cypherDirective || !cypherDirective.arguments) {
    return [];
  }

  const statementArg = cypherDirective.arguments.find(
    arg => arg.name.value === 'statement'
  );
  if (statementArg) {
    const statement = extractArgumentStringValue(statementArg);
    if (!statement) {
      throw new Error(`@cypher directive 'statement' arg must be a string.`);
    }
    return [
      {
        statement: statement.trim(),
      },
    ];
  }

  const statementsArg = cypherDirective.arguments.find(
    arg => arg.name.value === 'statements'
  );

  if (!statementsArg) {
    throw new Error(
      `@cypher directive on '${
        field.name
      }' must specify either 'statement' or 'statements' argument`
    );
  }

  return valueNodeToValue(statementsArg.value, {}).map(item => ({
    ...item,
    statement: item.statement.trim(),
  }));
};

export const isCypherSkip = (
  schemaType: GraphQLObjectType,
  fieldName: string
) => {
  const field = schemaType.getFields()[fieldName];
  if (!field || !field.astNode) {
    return false;
  }

  return (
    field.astNode.directives &&
    field.astNode.directives.some(
      directive => directive.name.value === 'cypherSkip'
    )
  );
};

export const isExternal = (info: GraphQLResolveInfo) => {
  const type = info.parentType.name;
  const field = info.fieldName;

  const schemaType = info.schema.getType(type);
  if (!schemaType || !schemaType.astNode) {
    throw new Error('Schema type was not found for ' + type);
  }

  if (isGraphqlScalarType(schemaType)) {
    return true;
  }

  const fieldNode = (schemaType as GraphQLObjectType).getFields()[field];

  return (
    fieldNode.astNode &&
    fieldNode.astNode.directives &&
    !fieldNode.astNode.directives.some(
      directive => directive.name.value === 'cypher'
    )
  );
};

export const valueNodeToValue = (
  valueNode: ValueNode,
  variables: { [variableName: string]: any }
) => {
  if (valueNode.kind === 'Variable') {
    return variables[valueNode.name.value];
  } else if (valueNode.kind === 'NullValue') {
    return null;
  } else if (valueNode.kind === 'ObjectValue') {
    return argFieldsToValues({}, valueNode.fields, variables);
  } else if (valueNode.kind === 'ListValue') {
    return valueNode.values.map(value => valueNodeToValue(value, variables));
  } else if (valueNode.kind === 'IntValue') {
    return parseInt(valueNode.value, 10);
  } else if (valueNode.kind === 'FloatValue') {
    return parseFloat(valueNode.value);
  } else {
    return valueNode.value;
  }
};

export const argFieldsToValues = (
  providedValues: { [key: string]: any },
  fields: readonly { value: ValueNode; name: NameNode }[],
  variables: { [variableName: string]: any }
) => {
  return fields.reduce((acc, fieldNode) => {
    acc[fieldNode.name.value] = valueNodeToValue(fieldNode.value, variables);
    return acc;
  }, providedValues);
};

export const getFragmentSelection = (
  fragmentNode: InlineFragmentNode | FragmentSpreadNode,
  fragments: { [key: string]: FragmentDefinitionNode }
): SelectionSetNode => {
  if (fragmentNode.kind === 'InlineFragment') {
    return fragmentNode.selectionSet;
  } else {
    const fragment = fragments[fragmentNode.name.value];
    if (!fragment) {
      throw new Error(
        `Unknown fragment "${
          fragmentNode.name.value
        } used; cannot extract fields`
      );
    }
    return fragment.selectionSet;
  }
};

/**
 * Converts a selection set into a list of field names.
 * @param existingFieldNames
 * @param selectionSet
 * @param fragments
 */
export const selectionSetToFieldNames = (
  existingFieldNames: string[],
  selectionSet: SelectionSetNode,
  fragments: { [key: string]: FragmentDefinitionNode }
): string[] => {
  // shallow iteration over each field in the selection set, adding its name
  // to the list
  return selectionSet.selections.reduce((names, selection) => {
    // flatten fragments by recursion
    if (
      selection.kind === 'InlineFragment' ||
      selection.kind === 'FragmentSpread'
    ) {
      return selectionSetToFieldNames(
        names,
        getFragmentSelection(selection, fragments),
        fragments
      );
    } else {
      // add field name to list
      return [...names, selection.name.value];
    }
  }, existingFieldNames);
};

export const extractObjectType = (
  type: GraphQLOutputType
): GraphQLObjectType<any, any, any> | null => {
  if (type instanceof GraphQLObjectType) {
    return type;
  }

  // TODO: Interface / Union

  if (type instanceof GraphQLNonNull || type instanceof GraphQLList) {
    return extractObjectType(type.ofType);
  }

  return null;
};

export const getNameOrAlias = (field: FieldNode) =>
  field.alias ? field.alias.value : field.name.value;

export const isRootField = (
  parentType: GraphQLObjectType,
  schema: GraphQLSchema
) => {
  const queryType = schema.getQueryType();
  const mutationType = schema.getMutationType();

  return [
    queryType && queryType.name,
    mutationType && mutationType.name,
  ].includes(parentType.name);
};

export const getArgumentsPlusDefaults = (
  parentTypeName: string,
  field: FieldNode,
  schema: GraphQLSchema,
  variables: { [name: string]: any }
): { [name: string]: any } => {
  const schemaType = schema.getType(parentTypeName);

  if (!schemaType || !(schemaType instanceof GraphQLObjectType)) {
    throw new Error(`Unknown or non-object type name "${parentTypeName}"`);
  }

  const schemaField = schemaType.getFields()[field.name.value];

  if (!schemaField) {
    throw new Error(
      `Field "${field.name.value}" was not found on type ${schemaType.name}`
    );
  }

  const defaults = schemaField.args.reduce(
    (argMap, arg) =>
      arg.defaultValue !== undefined
        ? { ...argMap, [arg.name]: arg.defaultValue }
        : argMap,
    {}
  );

  return {
    ...defaults,
    ...argFieldsToValues({}, field.arguments || [], variables),
  };
};

/** creates an 'open' promise which can be resolved externally */
export const createOpenPromise = () => {
  let resolve: (data: any) => void = () => {};
  let reject: (error: Error) => void = () => {};

  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve,
    reject,
  };
};

export const isListOrWrappedListType = (type: GraphQLOutputType) => {
  if (isListType(type)) {
    return true;
  }
  if (isNonNullType(type)) {
    return isListOrWrappedListType(type.ofType);
  }
  return false;
};

export const isDefaultResolver = (
  schema: GraphQLSchema,
  typeName: string,
  fieldName?: string
) => {
  const type = schema.getType(typeName);
  if (!type || isInputObjectType(type)) {
    return true;
  }

  if (isObjectType(type) || isInterfaceType(type)) {
    if (!fieldName) {
      return true;
    }

    const field = type.getFields()[fieldName];
    if (!field) {
      return true;
    }

    return !field.resolve;
  } else if (isUnionType(type)) {
    return !type.resolveType;
  } else {
    return true;
  }
};

export const getGeneratedArgsFromDirectives = (
  schemaType: GraphQLObjectType,
  fieldName: string
): { [name: string]: any } | null => {
  const field = schemaType.getFields()[fieldName];
  if (!field || !field.astNode) {
    return [];
  }

  const generateIdDirective = field.astNode.directives
    ? field.astNode.directives.find(
        directive => directive.name.value === 'generateId'
      )
    : null;

  if (!generateIdDirective) {
    return null;
  }

  const generatedIdArgNameArgument =
    generateIdDirective.arguments &&
    generateIdDirective.arguments.find(arg => arg.name.value === 'argName');

  const generatedIdArgName =
    (generatedIdArgNameArgument &&
      extractArgumentStringValue(generatedIdArgNameArgument)) ||
    'id';

  return {
    [generatedIdArgName]: uuid(),
  };
};
