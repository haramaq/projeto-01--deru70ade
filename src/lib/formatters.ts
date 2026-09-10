/**
 * Formats a numeric value into Brazilian Real currency string.
 * Example: 1234567.89 -> "R$ 1.234.567,89"
 */
export function formatCurrencyBRL(value: number | string | null | undefined): string {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0)
  if (isNaN(num)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num)
}

/**
 * Validates Brazilian CNPJ format (either raw 14 digits or formatted XX.XXX.XXX/XXXX-XX)
 */
export function validateCNPJ(cnpj: string): boolean {
  if (!cnpj) return true // optional field in some forms unless required
  const clean = cnpj.replace(/\D/g, '')
  if (clean.length !== 14) return false
  if (/^(\d)\1{13}$/.test(clean)) return false

  // Validate check digits
  let length = 12
  let numbers = clean.substring(0, length)
  const digits = clean.substring(length)
  let sum = 0
  let pos = length - 7
  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i), 10) * pos--
    if (pos < 2) pos = 9
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(digits.charAt(0), 10)) return false

  length = 13
  numbers = clean.substring(0, length)
  sum = 0
  pos = length - 7
  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i), 10) * pos--
    if (pos < 2) pos = 9
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(digits.charAt(1), 10)) return false

  return true
}

/**
 * Mask raw input string to CNPJ format: XX.XXX.XXX/XXXX-XX
 */
export function maskCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

/**
 * Mask phone number: (XX) XXXXX-XXXX or (XX) XXXX-XXXX
 */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  }
  return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}

/**
 * Format ISO date string to Brazilian date (DD/MM/YYYY)
 */
export function formatDateBR(dateStr?: string | null): string {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '-'
    return d.toLocaleDateString('pt-BR')
  } catch {
    return '-'
  }
}
