export function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (<>
    <h1 className="page-title">{title}</h1>
    <div className="card coming-soon">Coming in {phase}.</div>
  </>);
}
