export type InventoryIcon = 'box' | 'container' | 'helmet' | 'pallet' | 'wrap' | 'vest';

const IST = 'Asia/Kolkata';

/** `HH:mm` wall-clock time in India Standard Time. */
export function clock(date: Date | null | undefined): string {
  if (!date) return '--:--';
  return new Intl.DateTimeFormat('en-GB', { timeZone: IST, hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

/** Today's date in IST as `YYYY-MM-DD`. */
export function istDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(date);
}

/** A moment today (IST) at `HH:mm`. */
export function todayAt(time: string): Date {
  return new Date(`${istDate()}T${time}:00+05:30`);
}

/** Maps a catalogue product to the icon the 3D cargo geometry understands. */
export function iconForProduct(product: { sku: string; name: string; category?: string }): InventoryIcon {
  const sku = product.sku.toUpperCase();
  if (sku.startsWith('PKG-CB')) return 'box';
  if (sku.startsWith('PKG-PC')) return 'container';
  if (sku.startsWith('PPE-SH')) return 'helmet';
  if (sku.startsWith('LOG-WP')) return 'pallet';
  if (sku.startsWith('PKG-SW')) return 'wrap';
  if (sku.startsWith('PPE-HV')) return 'vest';

  const category = (product.category ?? '').toLowerCase();
  if (category === 'components') return 'container';

  const name = product.name.toLowerCase();
  if (/helmet/.test(name)) return 'helmet';
  if (/vest|hi-vis/.test(name)) return 'vest';
  if (/wrap|film/.test(name)) return 'wrap';
  if (/pallet/.test(name)) return 'pallet';
  if (/container|crate|bin/.test(name)) return 'container';
  return 'box';
}
