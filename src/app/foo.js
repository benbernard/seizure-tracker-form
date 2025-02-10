/** @CustomParams
{
}
*/

function validateInput(body) {
  if (!body) {
    return { error: "Input body is missing" };
  }

  if (!("duration" in body)) {
    return { error: "Missing key: duration" };
  }

  if (!("date" in body)) {
    return { error: "Missing key: date" };
  }

  if (!("note" in body)) {
    return { error: "Missing key: note" };
  }

  if (typeof body.duration !== "number") {
    return { error: "Duration must be a number" };
  }

  if (typeof body.date !== "string") {
    return { error: "Date must be a string" };
  }

  if (typeof body.note !== "string") {
    return { error: "Note must be a string" };
  }

  return { body, message: "Input is valid" };
}

export default async function run({ execution_id, input, data, store, db }) {
  const body = JSON.parse(data["{{2.body}}"]);
  const validationResult = validateInput(body);

  if (validationResult.error) {
    return { error: validationResult.error };
  }

  const { duration, date, note } = validationResult.body;
  const rows = JSON.parse(data["{{10.result}}"]);

  console.log("rows", rows[3433]);
  const matchingRows = rows
    .map((row, index) => ({ row, index }))
    .filter(
      ({ row }) =>
        row[0] === date &&
        row[1] === duration.toString() &&
        row[2].trim() === note.trim(),
    )
    .map(({ row, index }) => ({
      ...row,
      index,
      rowNum: (index + 1).toString(),
    }))
    .sort((a, b) => b.index - a.index);

  if (matchingRows.length === 0) {
    return {
      error: `No matching rows found for date: ${date}, duration: ${duration}, note: ${note}`,
    };
  }
  // const matchingRows = rows
  //   .map((row, index) => ({ row, index }))
  //   .filter(({ row }) => row[1] === 999)
  //   .map(({ row, index }) => ({ ...row, index }));

  return {
    message: validationResult.message,
    matchingRows,
  };
}
