import { describe, expect, it } from 'vitest'
import { hourGreeting } from './greeting'

describe('hourGreeting', () => {
  it.each([
    [5, 'home.greeting.morning'],
    [11, 'home.greeting.morning'],
    [12, 'home.greeting.afternoon'],
    [17, 'home.greeting.afternoon'],
    [18, 'home.greeting.night'],
    [19, 'home.greeting.night'],
    [23, 'home.greeting.night'],
    [0, 'home.greeting.night'],
    [4, 'home.greeting.night']
  ] as const)('greets at %s o clock with %s', (hour, key) => {
    expect(hourGreeting(hour)).toBe(key)
  })
})
