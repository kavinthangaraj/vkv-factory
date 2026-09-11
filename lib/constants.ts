export const WORKERS = ['Kavitha', 'Hari', 'Gopal', 'Mathi'] as const;
export const OFFICES = ['VKV', 'Gangapuram'] as const;
export const UNITS = [
  'kg', 'litre', 'piece', 'bundle', 'set',
  'metre', 'box', 'bag', 'drum', 'roll', 'number', 'pair',
] as const;
export const URGENCY_OPTIONS = ['Normal', 'Urgent'] as const;
export const STATUS_OPTIONS = ['Approved', 'Rejected'] as const;
export const CATEGORIES = [
  'Fuel', 'Transport', 'Utilities', 'Welfare',
  'Labour', 'Maintenance', 'Admin', 'Other',
] as const;

export const PETTY_CASH_PURPOSES: { label: string; category: string }[] = [
  { label: 'பெட்ரோல் - 2 Wheeler Fuel',         category: 'Fuel' },
  { label: 'பஸ் பார்சல் - Bus Parcel',            category: 'Transport' },
  { label: 'ஆட்டோ / கேப் - Auto / Cab Fare',     category: 'Transport' },
  { label: 'குடிநீர் கேன் - Drinking Water',      category: 'Utilities' },
  { label: 'டீ / சாப்பாடு - Tea / Snacks',       category: 'Welfare' },
  { label: 'தினசரி கூலி - Casual Labour',        category: 'Labour' },
  { label: 'சிறிய பழுது - Minor Repair',          category: 'Maintenance' },
  { label: 'கம்பி / நட்டு / போல்ட் - Hardware',  category: 'Maintenance' },
  { label: 'எழுதுபொருள் - Stationery',           category: 'Admin' },
  { label: 'கூரியர் / தபால் - Courier / Post',   category: 'Admin' },
  { label: 'மருந்து / முதலுதவி - Medical',       category: 'Welfare' },
  { label: 'மொபைல் ரீசார்ஜ் - Mobile Recharge', category: 'Admin' },
  { label: 'வேறு - Other',                        category: 'Other' },
];

// Derive category from a selected purpose label
export function getCategoryForPurpose(purposeLabel: string): string {
  return PETTY_CASH_PURPOSES.find((p) => p.label === purposeLabel)?.category ?? 'Other';
}

// Allowed admin emails — loaded from env, fallback to empty (allows all)
export const ALLOWED_EMAILS: string[] =
  (process.env.NEXT_PUBLIC_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
