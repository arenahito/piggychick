export const parseJsonc = (input: string): unknown => {
  const withoutComments = stripComments(input);
  const sanitized = stripTrailingCommas(withoutComments);
  if (!sanitized.trim()) {
    return {};
  }
  return JSON.parse(sanitized);
};

const stripComments = (input: string) => {
  let output = "";
  let inString = false;
  let stringQuote = "";
  let escape = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false;
        output += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "\n") {
        output += "\n";
      }
      if (char === "*" && next === "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (inString) {
      output += char;
      if (escape) {
        escape = false;
        continue;
      }
      if (char === "\\") {
        escape = true;
        continue;
      }
      if (char === stringQuote) {
        inString = false;
        stringQuote = "";
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringQuote = char;
      output += char;
      continue;
    }

    if (char === "/" && next === "/") {
      inLineComment = true;
      i += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      output += " ";
      inBlockComment = true;
      i += 1;
      continue;
    }

    output += char;
  }

  return output;
};

const stripTrailingCommas = (input: string) => {
  let output = "";
  let inString = false;
  let stringQuote = "";
  let escape = false;

  const isWhitespace = (char: string) =>
    char === " " || char === "\n" || char === "\r" || char === "\t";

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (inString) {
      output += char;
      if (escape) {
        escape = false;
        continue;
      }
      if (char === "\\") {
        escape = true;
        continue;
      }
      if (char === stringQuote) {
        inString = false;
        stringQuote = "";
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringQuote = char;
      output += char;
      continue;
    }

    if (char === ",") {
      let j = i + 1;
      while (j < input.length && isWhitespace(input[j])) {
        j += 1;
      }
      if (input[j] === "}" || input[j] === "]") {
        continue;
      }
    }

    output += char;
  }

  return output;
};
