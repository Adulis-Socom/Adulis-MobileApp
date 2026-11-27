/** An Amharic entry: explicitly pending, or a human-reviewed translation with the same {slots} as English. */
export type AmEntry = { readonly status: 'PENDING' } | { readonly status: 'REVIEWED'; readonly text: string };
