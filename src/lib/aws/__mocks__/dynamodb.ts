type Item = Record<string, unknown>;

const tables = new Map<string, Item[]>();

const keySchemas: Record<string, string[]> = {
  seizures: ["patient", "date"],
  patients: ["id"],
  settings: ["id"],
  "medication-changes": ["id", "date"],
};

const partitionKeys: Record<string, string> = {
  seizures: "patient",
  "medication-changes": "id",
};

export function resetTables(): void {
  tables.clear();
}

export function getTable(name: string): Item[] {
  if (!tables.has(name)) {
    tables.set(name, []);
  }
  return tables.get(name) as Item[];
}

function getTableItems(name: string): Item[] {
  if (!tables.has(name)) {
    tables.set(name, []);
  }
  return tables.get(name) as Item[];
}

function keysMatch(item: Item, key: Item): boolean {
  return Object.entries(key).every(([k, v]) => item[k] === v);
}

function resolveValue(
  token: string,
  values: Record<string, unknown>,
  names: Record<string, string>,
): unknown {
  if (token.startsWith(":")) {
    return values[token];
  }
  if (token.startsWith("#")) {
    return names[token];
  }
  return token;
}

function resolveAttr(
  expression: string,
  names: Record<string, string>,
): string {
  return expression.startsWith("#")
    ? (names[expression] ?? expression)
    : expression;
}

function evaluateCondition(
  expression: string,
  item: Item,
  values: Record<string, unknown> = {},
  names: Record<string, string> = {},
): boolean {
  const trimmed = expression.trim();

  const betweenMatch = trimmed.match(
    /^(.+?)\s+BETWEEN\s+(\S+)\s+AND\s+(\S+)$/i,
  );
  if (betweenMatch) {
    const attr = resolveAttr(betweenMatch[1].trim(), names);
    const start = resolveValue(betweenMatch[2], values, names);
    const end = resolveValue(betweenMatch[3], values, names);
    const v = item[attr];
    return (
      typeof v === "number" &&
      typeof start === "number" &&
      typeof end === "number" &&
      v >= start &&
      v <= end
    );
  }

  const andMatch = trimmed.match(/^(.+?)\s+AND\s+(.+)$/i);
  if (andMatch) {
    return (
      evaluateCondition(andMatch[1], item, values, names) &&
      evaluateCondition(andMatch[2], item, values, names)
    );
  }

  const gteMatch = trimmed.match(/^(.+?)\s*>=\s*(\S+)$/i);
  if (gteMatch) {
    const attr = resolveAttr(gteMatch[1].trim(), names);
    const right = resolveValue(gteMatch[2], values, names);
    const v = item[attr];
    return typeof v === "number" && typeof right === "number" && v >= right;
  }

  const eqMatch = trimmed.match(/^(.+?)\s*=\s*(\S+)$/i);
  if (eqMatch) {
    const attr = resolveAttr(eqMatch[1].trim(), names);
    const right = resolveValue(eqMatch[2], values, names);
    return item[attr] === right;
  }

  throw new Error(`Unsupported condition: ${trimmed}`);
}

function parseKeyCondition(
  expression: string,
  values: Record<string, unknown>,
  names: Record<string, string>,
  tableName: string,
): { partitionValue: unknown; sortCondition?: string } {
  const partitionKey = partitionKeys[tableName];
  const match = expression.match(/^(.+?)\s*=\s*(\S+)\s*(?:AND\s+(.+))?$/i);
  if (!match) {
    throw new Error(`Unsupported key condition: ${expression}`);
  }
  const attr = resolveAttr(match[1].trim(), names);
  if (attr !== partitionKey) {
    throw new Error(
      `Expected partition key ${partitionKey}, got ${attr} in ${expression}`,
    );
  }
  const partitionValue = resolveValue(match[2], values, names);
  const sortCondition = match[3]?.trim();
  return { partitionValue, sortCondition };
}

function applyUpdate(
  item: Item,
  expression: string,
  values: Record<string, unknown>,
  names: Record<string, string>,
): void {
  const setMatch = expression.match(/^SET\s+(.+)$/i);
  if (!setMatch) {
    throw new Error(`Unsupported update expression: ${expression}`);
  }
  const assignments = setMatch[1].split(",");
  for (const assignment of assignments) {
    const eqMatch = assignment.match(/^(.+?)\s*=\s*(\S+)$/i);
    if (!eqMatch) {
      throw new Error(`Unsupported assignment: ${assignment}`);
    }
    const attr = resolveAttr(eqMatch[1].trim(), names);
    const value = resolveValue(eqMatch[2], values, names);
    item[attr] = value;
  }
}

export const docClient = {
  send: jest.fn(async (command: { input: Record<string, unknown> }) => {
    const input = command.input;
    const name = command.constructor.name;
    const tableName = input.TableName as string;
    const items = getTableItems(tableName);

    if (name === "GetCommand") {
      const key = input.Key as Item;
      return { Item: items.find((item) => keysMatch(item, key)) };
    }

    if (name === "PutCommand") {
      const item = input.Item as Item;
      const schema = keySchemas[tableName];
      const existingIndex = items.findIndex((existing) =>
        schema.every((key) => existing[key] === item[key]),
      );
      if (existingIndex >= 0) {
        items[existingIndex] = item;
      } else {
        items.push(item);
      }
      return {};
    }

    if (name === "DeleteCommand") {
      const key = input.Key as Item;
      const index = items.findIndex((item) => keysMatch(item, key));
      if (index >= 0) {
        items.splice(index, 1);
      }
      return {};
    }

    if (name === "ScanCommand") {
      let result = [...items];
      if (input.FilterExpression) {
        result = result.filter((item) =>
          evaluateCondition(
            input.FilterExpression as string,
            item,
            (input.ExpressionAttributeValues as Record<string, unknown>) ?? {},
            (input.ExpressionAttributeNames as Record<string, string>) ?? {},
          ),
        );
      }
      return { Items: result, Count: result.length };
    }

    if (name === "QueryCommand") {
      const partitionKey = partitionKeys[tableName];
      const { partitionValue, sortCondition } = parseKeyCondition(
        input.KeyConditionExpression as string,
        (input.ExpressionAttributeValues as Record<string, unknown>) ?? {},
        (input.ExpressionAttributeNames as Record<string, string>) ?? {},
        tableName,
      );
      let result = items.filter(
        (item) => item[partitionKey] === partitionValue,
      );
      if (sortCondition) {
        result = result.filter((item) =>
          evaluateCondition(
            sortCondition,
            item,
            (input.ExpressionAttributeValues as Record<string, unknown>) ?? {},
            (input.ExpressionAttributeNames as Record<string, string>) ?? {},
          ),
        );
      }
      const sortKey = keySchemas[tableName]?.[1];
      if (sortKey) {
        result.sort((a, b) => (a[sortKey] as number) - (b[sortKey] as number));
      }
      if (input.ScanIndexForward === false) {
        result.reverse();
      }
      return { Items: result, Count: result.length };
    }

    if (name === "UpdateCommand") {
      const key = input.Key as Item;
      const item = items.find((i) => keysMatch(i, key));
      if (item) {
        applyUpdate(
          item,
          input.UpdateExpression as string,
          (input.ExpressionAttributeValues as Record<string, unknown>) ?? {},
          (input.ExpressionAttributeNames as Record<string, string>) ?? {},
        );
      }
      return {};
    }

    if (name === "BatchWriteCommand") {
      const requestItems = input.RequestItems as Record<string, unknown[]>;
      for (const [table, requests] of Object.entries(requestItems)) {
        const tableItems = getTableItems(table);
        const schema = keySchemas[table];
        for (const request of requests) {
          const deleteRequest = request as { DeleteRequest?: { Key: Item } };
          const putRequest = request as { PutRequest?: { Item: Item } };
          if (deleteRequest.DeleteRequest) {
            const key = deleteRequest.DeleteRequest.Key;
            const index = tableItems.findIndex((item) =>
              schema.every((k) => item[k] === key[k]),
            );
            if (index >= 0) {
              tableItems.splice(index, 1);
            }
          } else if (putRequest.PutRequest) {
            const item = putRequest.PutRequest.Item;
            const existingIndex = tableItems.findIndex((existing) =>
              schema.every((k) => existing[k] === item[k]),
            );
            if (existingIndex >= 0) {
              tableItems[existingIndex] = item;
            } else {
              tableItems.push(item);
            }
          }
        }
      }
      return {};
    }

    throw new Error(`Unsupported command: ${name}`);
  }),
};
