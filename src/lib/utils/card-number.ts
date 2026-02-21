/**
 * Card number utility for REVISIT loyalty platform.
 * Format: #XXXX-D where XXXX is a 4-digit zero-padded sequence and D is a Luhn check digit (0-9).
 */

/**
 * Computes the Luhn check digit for a 4-digit string.
 * Iterates right-to-left, doubling every second digit from the right (0-indexed).
 * Returns a single digit string (0-9).
 */
function computeLuhnDigit(digits: string): string {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = parseInt(digits[digits.length - 1 - i], 10)
    if (i % 2 === 1) {
      // Double every second digit from the right (0-indexed)
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return String((10 - (sum % 10)) % 10)
}

/**
 * Generates a card number in #XXXX-D format.
 * @param sequence - integer 1-9999
 * @throws Error if sequence is outside 1-9999 range
 */
export function generateCardNumber(sequence: number): string {
  if (sequence < 1 || sequence > 9999) {
    throw new Error('Sequence must be between 1 and 9999')
  }
  const xxxx = String(sequence).padStart(4, '0')
  const d = computeLuhnDigit(xxxx)
  return `#${xxxx}-${d}`
}

/**
 * Validates a card number string in #XXXX-D format.
 * Returns true only if the format matches and the check digit is correct.
 */
export function validateCardNumber(input: string): boolean {
  const match = input.match(/^#(\d{4})-(\d)$/)
  if (!match) return false
  const [, xxxx, d] = match
  return computeLuhnDigit(xxxx) === d
}

/**
 * Extracts the numeric sequence from a valid card number string.
 * Call only after validateCardNumber() returns true.
 * @param cardNumber - e.g. '#0001-9'
 * @returns the 4-digit sequence as an integer (e.g. 1)
 */
export function extractSequence(cardNumber: string): number {
  return parseInt(cardNumber.slice(1, 5), 10)
}
