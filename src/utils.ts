import {
  GraphQLScalarType,
  GraphQLNamedType,
  GraphQLResolveInfo,
  ResponsePath,
  GraphQLObjectType,
  GraphQLInterfaceType,
  SelectionNode,
  FieldNode,
  SelectionSetNode,
  GraphQLSchema,
  ArgumentNode,
  ObjectFieldNode,
  ValueNode,
  NameNode,
  ListValueNode,
  ObjectValueNode,
  FragmentDefinitionNode,
  InlineFragmentNode,
  FragmentSpreadNode,
  GraphQLField,
  GraphQLOutputType,
  GraphQLNonNull,
  GraphQLEnumType,
  GraphQLList,
} from 'graphql';
import { CypherConditionalStatement } from 'types';

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

export function getFieldPath(info: GraphQLResolveInfo) {
  const path: (string | number)[] = [];
  let pathLink: ResponsePath | undefined = info.path;
  while (pathLink) {
    path.unshift(pathLink.key);
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
        statement,
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

  return valueNodeToValue(statementsArg.value, {});
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
