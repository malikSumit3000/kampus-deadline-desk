export default function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="empty-state">
      <span aria-hidden="true">✓</span>
      <h2>{title}</h2>
      <p>{copy}</p>
    </div>
  );
}
