/** The phase-1 empty state, shared by every page that needs an active character. */
export function NoCharacter({ title }: { title: string }) {
  return (<>
    <h1 className="page-title">{title}</h1>
    <div className="card coming-soon">No characters yet — use the menu top-right to add one.</div>
  </>);
}
