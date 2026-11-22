/** One line above the Settings panels when adding or re-authorising a character failed (/settings?error=<code>). */
export function AuthoriseError({ error }: { error: string | null }) {
  if (error === null) return null;
  return <p className="warn-text" role="alert">That character could not be authorised. Please try again.</p>;
}
