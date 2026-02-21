import { describe, it, expect } from 'vitest'
import { generateCardNumber, validateCardNumber, extractSequence } from './card-number'

describe('generateCardNumber', () => {
  it('returns #0001-9 for sequence 1', () => {
    expect(generateCardNumber(1)).toBe('#0001-9')
  })

  it('returns #0002-8 for sequence 2', () => {
    expect(generateCardNumber(2)).toBe('#0002-8')
  })

  it('returns #0005-5 for sequence 5', () => {
    expect(generateCardNumber(5)).toBe('#0005-5')
  })

  it('returns a valid card number for sequence 9999', () => {
    const card = generateCardNumber(9999)
    expect(validateCardNumber(card)).toBe(true)
  })

  it('throws for sequence 0', () => {
    expect(() => generateCardNumber(0)).toThrow()
  })

  it('throws for sequence 10000', () => {
    expect(() => generateCardNumber(10000)).toThrow()
  })
})

describe('validateCardNumber', () => {
  it('returns true for #0001-9', () => {
    expect(validateCardNumber('#0001-9')).toBe(true)
  })

  it('returns false for #0001-0 (wrong check digit)', () => {
    expect(validateCardNumber('#0001-0')).toBe(false)
  })

  it('returns false for #0001-A (letter in check digit position)', () => {
    expect(validateCardNumber('#0001-A')).toBe(false)
  })

  it('returns false for 0001-9 (missing #)', () => {
    expect(validateCardNumber('0001-9')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(validateCardNumber('')).toBe(false)
  })
})

describe('extractSequence', () => {
  it('returns 1 for #0001-9', () => {
    expect(extractSequence('#0001-9')).toBe(1)
  })
})
