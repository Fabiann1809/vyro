import { describe, expect, it } from 'vitest'
import { compileExpression, type EvalContext } from './expression'

const METRICS = ['knee', 'torso', 'elbowDrift']

function context(
  series: Record<string, number[]> = {},
  scalars: EvalContext['scalars'] = {}
): EvalContext {
  return { series, scalars }
}

// Compiles an expression that must be valid and evaluates it.
function run(source: string, ctx: EvalContext = context()): boolean | null {
  const result = compileExpression(source, METRICS)
  if (!result.ok) throw new Error(`"${source}" should compile but: ${result.error}`)
  return result.expression.evaluate(ctx)
}

// Compiles an expression that must be rejected and returns the error.
function errorOf(source: string): string {
  const result = compileExpression(source, METRICS)
  if (result.ok) throw new Error(`"${source}" should not compile`)
  return result.error
}

describe('functions over a metric', () => {
  const ctx = context({ knee: [170, 120, 90, 110, 172] })

  it.each([
    ['min(knee) == 90', true],
    ['max(knee) == 172', true],
    ['range(knee) == 82', true],
    ['avg(knee) == 132.4', true],
    ['first(knee) == 170', true],
    ['last(knee) == 172', true],
    ['min(knee) <= 100', true],
    ['min(knee) <= 80', false]
  ])('%s is %s', (source, expected) => {
    expect(run(source, ctx)).toBe(expected)
  })

  it('takes the absolute value of a number', () => {
    expect(run('abs(-5) == 5')).toBe(true)
    expect(run('abs(first(knee) - last(knee)) == 2', ctx)).toBe(true)
  })
})

describe('numbers and arithmetic', () => {
  it('follows the usual precedence', () => {
    expect(run('1 + 2 * 3 == 7')).toBe(true)
    expect(run('(1 + 2) * 3 == 9')).toBe(true)
    expect(run('10 - 4 - 3 == 3')).toBe(true)
    expect(run('2 * 3 + 4 * 5 == 26')).toBe(true)
  })

  it('divides and handles decimals', () => {
    expect(run('10 / 4 == 2.5')).toBe(true)
    expect(run('.5 + .25 == 0.75')).toBe(true)
  })

  it('supports negative numbers and double negation', () => {
    expect(run('-5 < 0')).toBe(true)
    expect(run('- -5 == 5')).toBe(true)
    expect(run('3 - -2 == 5')).toBe(true)
  })

  it('compares with every operator', () => {
    expect(run('1 < 2')).toBe(true)
    expect(run('2 <= 2')).toBe(true)
    expect(run('3 > 2')).toBe(true)
    expect(run('2 >= 3')).toBe(false)
    expect(run('2 != 3')).toBe(true)
    expect(run('2 == 2')).toBe(true)
  })

  it('combines metrics in arithmetic', () => {
    const ctx = context({ knee: [100, 90], torso: [10, 20] })

    expect(run('max(torso) - min(torso) == range(torso)', ctx)).toBe(true)
    expect(run('min(knee) / 2 == 45', ctx)).toBe(true)
  })
})

describe('logic', () => {
  it('joins conditions with && and ||', () => {
    expect(run('true && false')).toBe(false)
    expect(run('true || false')).toBe(true)
    expect(run('1 < 2 && 2 < 3')).toBe(true)
  })

  it('negates with !', () => {
    expect(run('!false')).toBe(true)
    expect(run('!(1 > 2)')).toBe(true)
  })

  it('gives && more weight than ||', () => {
    expect(run('true || false && false')).toBe(true)
    expect(run('(true || false) && false')).toBe(false)
  })

  it('mixes metrics and scalars', () => {
    const ctx = context({ knee: [170, 95, 172], torso: [5, 20, 6] }, { durationMs: 1500 })

    expect(run('min(knee) <= 100 && range(torso) < 10 && durationMs >= 800', ctx)).toBe(false)
    expect(run('min(knee) <= 100 && range(torso) < 10 || durationMs >= 800', ctx)).toBe(true)
  })

  it('compares two conditions', () => {
    expect(run('(1 < 2) == (2 < 3)')).toBe(true)
    expect(run('(1 < 2) != (3 < 2)')).toBe(true)
  })
})

describe('repetition values', () => {
  it('reads the scalars of the repetition', () => {
    const ctx = context({}, { durationMs: 1200, descentMs: 700, ascentMs: 500 })

    expect(run('durationMs >= 800', ctx)).toBe(true)
    expect(run('descentMs >= 800', ctx)).toBe(false)
    expect(run('descentMs + ascentMs == durationMs', ctx)).toBe(true)
  })
})

describe('missing data', () => {
  it('cannot judge a metric that was never measured', () => {
    expect(run('min(knee) <= 100', context({ knee: [] }))).toBeNull()
    expect(run('min(knee) <= 100', context())).toBeNull()
  })

  it('cannot judge a scalar that is not available', () => {
    expect(run('descentMs >= 800', context())).toBeNull()
  })

  it('does not turn a division by zero into infinity', () => {
    expect(run('1 / 0 > 5')).toBeNull()
    expect(run('1 / (2 - 2) < 5')).toBeNull()
  })

  it('lets a known false or true decide, as in three-valued logic', () => {
    const none = context()

    expect(run('min(knee) < 5 && false', none)).toBe(false)
    expect(run('false && min(knee) < 5', none)).toBe(false)
    expect(run('min(knee) < 5 && true', none)).toBeNull()
    expect(run('min(knee) < 5 || true', none)).toBe(true)
    expect(run('min(knee) < 5 || false', none)).toBeNull()
    expect(run('!(min(knee) < 5)', none)).toBeNull()
  })

  it('propagates through arithmetic and abs', () => {
    expect(run('abs(min(knee)) > 1', context())).toBeNull()
    expect(run('min(knee) + 1 > 1', context())).toBeNull()
  })
})

describe('reuse', () => {
  it('evaluates the same compiled expression for different repetitions', () => {
    const result = compileExpression('min(knee) <= 100', METRICS)
    if (!result.ok) throw new Error(result.error)

    expect(result.expression.evaluate(context({ knee: [170, 90] }))).toBe(true)
    expect(result.expression.evaluate(context({ knee: [170, 130] }))).toBe(false)
    expect(result.expression.evaluate(context({ knee: [170, 80] }))).toBe(true)
  })
})

describe('mistakes the author can make', () => {
  it('names an unknown metric and suggests the closest one', () => {
    expect(errorOf('min(kne) <= 100')).toBe(
      'unknown name "kne" (did you mean "knee"?) (at position 5)'
    )
  })

  it('does not suggest anything when nothing is close', () => {
    expect(errorOf('min(banana) <= 100')).toBe('unknown name "banana" (at position 5)')
  })

  it('names an unknown function and suggests the closest one', () => {
    expect(errorOf('mim(knee) <= 100')).toContain('unknown function "mim" (did you mean "min"?)')
  })

  it('rejects a metric used without a function', () => {
    expect(errorOf('knee <= 100')).toContain(
      'wrap it in min(), max(), range(), avg(), first() or last()'
    )
  })

  it('rejects a function that needs a metric but gets a number', () => {
    expect(errorOf('min(5) <= 100')).toContain('"min" needs a metric of the skill')
  })

  it('rejects abs on a metric', () => {
    expect(errorOf('abs(knee) < 5')).toContain('"abs" needs a number')
  })

  it('rejects the wrong number of arguments', () => {
    expect(errorOf('min(knee, torso) < 5')).toContain('takes exactly one argument, not 2')
    expect(errorOf('min() < 5')).toContain('takes exactly one argument, not 0')
  })

  it('rejects an expression that is not a condition', () => {
    expect(errorOf('min(knee)')).toContain('must be a condition')
    expect(errorOf('5')).toContain('must be a condition')
  })

  it('rejects comparing a number with a condition', () => {
    expect(errorOf('min(knee) == true')).toContain('compares two numbers or two conditions')
    expect(errorOf('1 < true')).toContain('not a number')
  })

  it('rejects logic over numbers', () => {
    expect(errorOf('1 && 2')).toContain('joins conditions')
    expect(errorOf('!5')).toContain('needs a condition')
  })

  it('rejects chained comparisons', () => {
    expect(errorOf('1 < 2 < 3')).toContain('not a number')
  })

  it('rejects a missing closing parenthesis', () => {
    expect(errorOf('(min(knee) <= 100')).toContain('missing closing ")"')
    expect(errorOf('min(knee <= 100')).toContain('missing closing ")"')
  })

  it('rejects leftovers after a complete expression', () => {
    expect(errorOf('min(knee) <= 100 )')).toContain('unexpected ")"')
    expect(errorOf('min(knee) <= 100 5')).toContain('unexpected number 5')
  })

  it('rejects an operator without an operand', () => {
    expect(errorOf('min(knee) <=')).toContain('unexpected end of the expression')
    expect(errorOf('<= 5')).toContain('unexpected "<="')
  })

  it('rejects a single = or & or |', () => {
    expect(errorOf('min(knee) = 100')).toContain('unexpected character "="')
    expect(errorOf('true & true')).toContain('unexpected character "&"')
    expect(errorOf('true | true')).toContain('unexpected character "|"')
  })

  it('rejects an empty expression', () => {
    expect(errorOf('')).toContain('is empty')
    expect(errorOf('   ')).toContain('is empty')
  })

  it('reports the position of the problem, counting from 1', () => {
    expect(errorOf('min(knee) <= $')).toBe('unexpected character "$" (at position 14)')
  })
})

describe('limits', () => {
  it('rejects a very long expression', () => {
    expect(errorOf(`1 < ${'1 + '.repeat(200)}1`)).toContain('longer than 500 characters')
  })

  it('rejects absurd nesting without crashing', () => {
    expect(errorOf(`${'('.repeat(100)}true${')'.repeat(100)}`)).toContain('nested too deeply')
    expect(errorOf(`${'!'.repeat(100)}true`)).toContain('nested too deeply')
  })

  it('accepts reasonable nesting', () => {
    expect(run(`${'('.repeat(10)}true${')'.repeat(10)}`)).toBe(true)
  })
})

describe('security: it only understands its own language', () => {
  const attacks = [
    'constructor',
    '__proto__',
    'this',
    'process.exit()',
    'knee.length > 0',
    'knee[0] > 0',
    '(() => true)()',
    'x => true',
    'eval("true")',
    'Function("return true")()',
    'globalThis',
    'window.alert(1)',
    'require("fs")',
    'import("fs")',
    '"true"',
    "'true'",
    '`true`',
    'true; true',
    'true, true',
    'true ? true : false',
    'typeof knee',
    'new Date()',
    'min(knee) <= 100 // comment',
    '/* c */ true',
    'toString()',
    'hasOwnProperty'
  ]

  it.each(attacks)('rejects %s', (source) => {
    expect(compileExpression(source, METRICS).ok).toBe(false)
  })

  it('never runs anything while compiling or evaluating', () => {
    const marker = '__vyroExpressionEscape'
    const scope = globalThis as Record<string, unknown>
    delete scope[marker]

    compileExpression(`globalThis.${marker} = true`, METRICS)
    compileExpression(`(${marker} = true)`, METRICS)

    expect(scope[marker]).toBeUndefined()
  })

  it('does not let a metric called like a built-in property reach the prototype', () => {
    const result = compileExpression('min(constructor) < 5', ['constructor'])
    if (!result.ok) throw new Error(result.error)

    // The series is looked up in a plain object: a prototype member must not leak in as data.
    expect(result.expression.evaluate({ series: {}, scalars: {} })).toBeNull()
    // Even a context that really holds the name works, and only with its own data.
    expect(result.expression.evaluate({ series: { constructor: [1] }, scalars: {} })).toBe(true)
  })
})
