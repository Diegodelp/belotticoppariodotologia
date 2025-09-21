export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('es-AR');
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS'
  }).format(amount);
}

export function cn(...classes: string[]): string {
  return classes.filter(Boolean).join(' ');
}
