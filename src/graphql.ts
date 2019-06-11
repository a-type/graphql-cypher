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
  isNamedType,
  GraphQLType,
} from 'graphql';
import { FieldMissingError } from './errors';

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

export const getArgumentsPlusDefaults = (
  parentTypeName: string,
  field: FieldNode,
  schema: GraphQLSchema,
  variables: { [name: string]: any }
): { [name: string]: any } => {
  const schemaType = schema.getType(parentTypeName);

  if (!schemaType || !isObjectType(schemaType)) {
    throw new Error(
      `Unknown or non-object type name "${parentTypeName} (type: ${schemaType})"`
    );
  }

  const schemaField = schemaType.getFields()[field.name.value];

  if (!schemaField) {
    throw new FieldMissingError(schemaType.name, field.name.value);
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

export const unwrapNamedType = (schemaType: GraphQLType): GraphQLNamedType => {
  if (isNamedType(schemaType)) {
    return schemaType;
  }

  return unwrapNamedType(schemaType.ofType);
};

export const getFieldTypeName = (
  schemaType: GraphQLObjectType,
  fieldName: string
) => {
  const field = schemaType.getFields()[fieldName];
  if (!field) {
    throw new FieldMissingError(schemaType.name, fieldName);
  }

  const namedType = unwrapNamedType(field.type);
  return namedType.name;
};
