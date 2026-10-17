// A tiny, closed expression language for the rules of a skill, for example:
//
//   min(knee) <= 100 && range(torso) < 10
//
// It is interpreted here, step by step. Nothing is ever passed to eval() or new Function(), so a
// configuration file can only do what this file allows: numbers, comparisons, logic and the
// functions below.

export const SERIES_FUNCTIONS = ['min', 'max', 'range', 'avg', 'first', 'last'] as const
export const SCALARS = ['durationMs', 'descentMs', 'ascentMs'] as const

export type ScalarName = (typeof SCALARS)[number]

export interface EvalContext {
  // Every value a metric took during the repetition, with the frames it could not be measured in left out.
  series: Readonly<Record<string, readonly number[]>>
  scalars: Readonly<Partial<Record<ScalarName, number>>>
}

export interface CompiledExpression {
  // true: the condition holds. false: it does not. null: it cannot be judged (missing data).
  evaluate: (context: EvalContext) => boolean | null
}

export type CompileResult =
  { ok: true; expression: CompiledExpression } | { ok: false; error: string }

const MAX_LENGTH = 500
const MAX_DEPTH = 40

type Type = 'number' | 'boolean' | 'series'
type Value = number | boolean | null | readonly number[]
type Run = (context: EvalContext) => Value

class ExpressionError extends Error {
  constructor(
    message: string,
    readonly position: number
  ) {
    super(message)
  }
}

// ---------------------------------------------------------------- tokens

type Token =
  | { kind: 'number'; value: number; position: number }
  | { kind: 'name'; value: string; position: number }
  | { kind: 'op'; value: string; position: number }
  | { kind: 'lparen' | 'rparen' | 'comma' | 'end'; position: number }

const TWO_CHAR_OPERATORS = ['<=', '>=', '==', '!=', '&&', '||']
const ONE_CHAR_OPERATORS = '<>+-*/!'

function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let index = 0

  while (index < source.length) {
    const char = source.charAt(index)

    if (/\s/.test(char)) {
      index++
    } else if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(source.charAt(index + 1)))) {
      const match = /^[0-9]*\.?[0-9]+/.exec(source.slice(index))
      const text = match?.[0] ?? char
      tokens.push({ kind: 'number', value: Number(text), position: index })
      index += text.length
    } else if (/[A-Za-z_]/.test(char)) {
      const text = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(index))?.[0] ?? char
      tokens.push({ kind: 'name', value: text, position: index })
      index += text.length
    } else if (TWO_CHAR_OPERATORS.includes(source.slice(index, index + 2))) {
      tokens.push({ kind: 'op', value: source.slice(index, index + 2), position: index })
      index += 2
    } else if (ONE_CHAR_OPERATORS.includes(char)) {
      tokens.push({ kind: 'op', value: char, position: index })
      index++
    } else if (char === '(') {
      tokens.push({ kind: 'lparen', position: index++ })
    } else if (char === ')') {
      tokens.push({ kind: 'rparen', position: index++ })
    } else if (char === ',') {
      tokens.push({ kind: 'comma', position: index++ })
    } else {
      throw new ExpressionError(`unexpected character "${char}"`, index)
    }
  }

  tokens.push({ kind: 'end', position: source.length })
  return tokens
}

// ---------------------------------------------------------------- syntax tree

type Node =
  | { kind: 'number'; value: number; position: number }
  | { kind: 'boolean'; value: boolean; position: number }
  | { kind: 'name'; name: string; position: number }
  | { kind: 'call'; name: string; args: Node[]; position: number }
  | { kind: 'unary'; op: string; operand: Node; position: number }
  | { kind: 'binary'; op: string; left: Node; right: Node; position: number }

// Lowest precedence first: each level is parsed in terms of the next one.
const BINARY_LEVELS: readonly (readonly string[])[] = [
  ['||'],
  ['&&'],
  ['==', '!='],
  ['<', '<=', '>', '>='],
  ['+', '-'],
  ['*', '/']
]

class Parser {
  private index = 0
  private depth = 0

  constructor(private readonly tokens: Token[]) {}

  parse(): Node {
    const node = this.parseLevel(0)
    const next = this.peek()
    if (next.kind !== 'end')
      throw new ExpressionError(`unexpected ${describe(next)}`, next.position)
    return node
  }

  private peek(): Token {
    return this.tokens[this.index] ?? { kind: 'end', position: 0 }
  }

  private take(): Token {
    const token = this.peek()
    this.index++
    return token
  }

  private enter(position: number): void {
    if (++this.depth > MAX_DEPTH)
      throw new ExpressionError('the expression is nested too deeply', position)
  }

  private parseLevel(level: number): Node {
    const operators = BINARY_LEVELS[level]
    if (!operators) return this.parseUnary()

    let left = this.parseLevel(level + 1)
    for (;;) {
      const token = this.peek()
      if (token.kind !== 'op' || !operators.includes(token.value)) break
      this.take()
      const right = this.parseLevel(level + 1)
      left = { kind: 'binary', op: token.value, left, right, position: token.position }
    }
    return left
  }

  private parseUnary(): Node {
    const token = this.peek()
    if (token.kind === 'op' && (token.value === '-' || token.value === '!')) {
      this.take()
      this.enter(token.position)
      const operand = this.parseUnary()
      this.depth--
      return { kind: 'unary', op: token.value, operand, position: token.position }
    }
    return this.parsePrimary()
  }

  private parsePrimary(): Node {
    const token = this.take()

    switch (token.kind) {
      case 'number':
        return { kind: 'number', value: token.value, position: token.position }
      case 'name':
        return this.peek().kind === 'lparen'
          ? this.parseCall(token.value, token.position)
          : token.value === 'true' || token.value === 'false'
            ? { kind: 'boolean', value: token.value === 'true', position: token.position }
            : { kind: 'name', name: token.value, position: token.position }
      case 'lparen': {
        this.enter(token.position)
        const inner = this.parseLevel(0)
        this.depth--
        const close = this.take()
        if (close.kind !== 'rparen')
          throw new ExpressionError('missing closing ")"', close.position)
        return inner
      }
      default:
        throw new ExpressionError(`unexpected ${describe(token)}`, token.position)
    }
  }

  private parseCall(name: string, position: number): Node {
    this.take() // "("
    this.enter(position)
    const args: Node[] = []

    if (this.peek().kind !== 'rparen') {
      for (;;) {
        args.push(this.parseLevel(0))
        if (this.peek().kind !== 'comma') break
        this.take()
      }
    }

    this.depth--
    const close = this.take()
    if (close.kind !== 'rparen') throw new ExpressionError('missing closing ")"', close.position)
    return { kind: 'call', name, args, position }
  }
}

function describe(token: Token): string {
  switch (token.kind) {
    case 'end':
      return 'end of the expression'
    case 'number':
      return `number ${token.value}`
    case 'name':
    case 'op':
      return `"${token.value}"`
    case 'lparen':
      return '"("'
    case 'rparen':
      return '")"'
    case 'comma':
      return '","'
  }
}

// ---------------------------------------------------------------- checking and compiling

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0] ?? 0
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const above = row[j] ?? 0
      row[j] = Math.min(
        above + 1,
        (row[j - 1] ?? 0) + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
      diagonal = above
    }
  }
  return row[b.length] ?? 0
}

function suggestion(name: string, known: readonly string[]): string {
  const best = known
    .map((candidate) => ({
      candidate,
      distance: editDistance(name.toLowerCase(), candidate.toLowerCase())
    }))
    .sort((a, b) => a.distance - b.distance)[0]
  return best && best.distance <= 2 ? ` (did you mean "${best.candidate}"?)` : ''
}

interface Compiled {
  type: Type
  run: Run
}

class Compiler {
  constructor(private readonly metricNames: ReadonlySet<string>) {}

  compile(node: Node): Compiled {
    switch (node.kind) {
      case 'number':
        return { type: 'number', run: () => node.value }
      case 'boolean':
        return { type: 'boolean', run: () => node.value }
      case 'name':
        return this.compileName(node)
      case 'call':
        return this.compileCall(node)
      case 'unary':
        return this.compileUnary(node)
      case 'binary':
        return this.compileBinary(node)
    }
  }

  private compileName(node: Extract<Node, { kind: 'name' }>): Compiled {
    const { name } = node

    if (this.metricNames.has(name)) {
      // Own properties only: a name such as "constructor" must never reach the prototype chain.
      return {
        type: 'series',
        run: (context) =>
          (Object.hasOwn(context.series, name) ? context.series[name] : undefined) ?? []
      }
    }
    if ((SCALARS as readonly string[]).includes(name)) {
      return { type: 'number', run: (context) => context.scalars[name as ScalarName] ?? null }
    }

    const known = [...this.metricNames, ...SCALARS]
    throw new ExpressionError(`unknown name "${name}"${suggestion(name, known)}`, node.position)
  }

  private compileCall(node: Extract<Node, { kind: 'call' }>): Compiled {
    const { name, args, position } = node
    const isSeriesFunction = (SERIES_FUNCTIONS as readonly string[]).includes(name)

    if (!isSeriesFunction && name !== 'abs') {
      const known = [...SERIES_FUNCTIONS, 'abs']
      throw new ExpressionError(`unknown function "${name}"${suggestion(name, known)}`, position)
    }
    if (args.length !== 1) {
      throw new ExpressionError(
        `"${name}" takes exactly one argument, not ${args.length}`,
        position
      )
    }

    const argument = this.compile(args[0] as Node)

    if (name === 'abs') {
      this.expect(argument, 'number', `"abs" needs a number`, position)
      return {
        type: 'number',
        run: (context) => {
          const value = argument.run(context)
          return typeof value === 'number' ? Math.abs(value) : null
        }
      }
    }

    this.expect(
      argument,
      'series',
      `"${name}" needs a metric of the skill, for example ${name}(knee)`,
      position
    )
    return {
      type: 'number',
      run: (context) => aggregate(name, argument.run(context) as readonly number[])
    }
  }

  private compileUnary(node: Extract<Node, { kind: 'unary' }>): Compiled {
    const operand = this.compile(node.operand)

    if (node.op === '-') {
      this.expect(operand, 'number', 'a minus sign needs a number', node.position)
      return {
        type: 'number',
        run: (context) => {
          const value = operand.run(context)
          return typeof value === 'number' ? -value : null
        }
      }
    }

    this.expect(operand, 'boolean', '"!" needs a condition (true or false)', node.position)
    return {
      type: 'boolean',
      run: (context) => {
        const value = operand.run(context)
        return typeof value === 'boolean' ? !value : null
      }
    }
  }

  private compileBinary(node: Extract<Node, { kind: 'binary' }>): Compiled {
    const { op, position } = node
    const left = this.compile(node.left)
    const right = this.compile(node.right)

    if (op === '&&' || op === '||') {
      this.expect(
        left,
        'boolean',
        `"${op}" joins conditions, but the left side is not one`,
        position
      )
      this.expect(
        right,
        'boolean',
        `"${op}" joins conditions, but the right side is not one`,
        position
      )
      return { type: 'boolean', run: (context) => logic(op, left.run(context), right.run(context)) }
    }

    if (op === '==' || op === '!=') {
      if (left.type !== right.type || left.type === 'series') {
        throw new ExpressionError(
          `"${op}" compares two numbers or two conditions, not ${left.type} and ${right.type}`,
          position
        )
      }
      return {
        type: 'boolean',
        run: (context) => {
          const a = left.run(context)
          const b = right.run(context)
          return a === null || b === null ? null : op === '==' ? a === b : a !== b
        }
      }
    }

    const verb = '<><=>='.includes(op) ? 'compare' : 'calculate with'
    this.expect(
      left,
      'number',
      `cannot ${verb} the left side of "${op}": it is not a number`,
      position
    )
    this.expect(
      right,
      'number',
      `cannot ${verb} the right side of "${op}": it is not a number`,
      position
    )

    return {
      type: ['<', '<=', '>', '>='].includes(op) ? 'boolean' : 'number',
      run: (context) => arithmetic(op, left.run(context), right.run(context))
    }
  }

  private expect(compiled: Compiled, type: Type, message: string, position: number): void {
    if (compiled.type === type) return

    const hint =
      compiled.type === 'series'
        ? ': a metric holds many values, wrap it in min(), max(), range(), avg(), first() or last()'
        : ''
    throw new ExpressionError(`${message}${hint}`, position)
  }
}

function aggregate(name: string, values: readonly number[]): number | null {
  const first = values[0]
  const last = values[values.length - 1]
  if (first === undefined || last === undefined) return null

  switch (name) {
    case 'min':
      return Math.min(...values)
    case 'max':
      return Math.max(...values)
    case 'range':
      return Math.max(...values) - Math.min(...values)
    case 'avg':
      return values.reduce((sum, value) => sum + value, 0) / values.length
    case 'first':
      return first
    default:
      return last
  }
}

function arithmetic(op: string, a: Value, b: Value): number | boolean | null {
  if (typeof a !== 'number' || typeof b !== 'number') return null

  switch (op) {
    case '+':
      return a + b
    case '-':
      return a - b
    case '*':
      return a * b
    case '/':
      return b === 0 ? null : a / b
    case '<':
      return a < b
    case '<=':
      return a <= b
    case '>':
      return a > b
    default:
      return a >= b
  }
}

// Three-valued logic: a missing answer only matters when the other side cannot decide.
function logic(op: string, a: Value, b: Value): boolean | null {
  const left = typeof a === 'boolean' ? a : null
  const right = typeof b === 'boolean' ? b : null

  if (op === '&&') {
    if (left === false || right === false) return false
    return left === null || right === null ? null : true
  }
  if (left === true || right === true) return true
  return left === null || right === null ? null : false
}

// ---------------------------------------------------------------- public API

// Checks the expression against the metrics of the skill and prepares it to run.
// Any mistake is reported here, when the skill loads, never in the middle of a session.
export function compileExpression(source: string, metricNames: readonly string[]): CompileResult {
  try {
    if (source.length > MAX_LENGTH) {
      throw new ExpressionError(
        `the expression is longer than ${MAX_LENGTH} characters`,
        MAX_LENGTH
      )
    }
    if (source.trim() === '') throw new ExpressionError('the expression is empty', 0)

    const tree = new Parser(tokenize(source)).parse()
    const compiled = new Compiler(new Set(metricNames)).compile(tree)

    if (compiled.type !== 'boolean') {
      throw new ExpressionError(
        `a rule must be a condition (for example "min(knee) <= 100"), but this gives a ${compiled.type}`,
        0
      )
    }

    return {
      ok: true,
      expression: {
        evaluate: (context) => {
          const value = compiled.run(context)
          return typeof value === 'boolean' ? value : null
        }
      }
    }
  } catch (error) {
    if (error instanceof ExpressionError) {
      return { ok: false, error: `${error.message} (at position ${error.position + 1})` }
    }
    throw error
  }
}
