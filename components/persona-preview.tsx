export function PersonaPreview() {
  return (
    <aside className="preview-card">
      <span className="preview-phone">Mochi on SMS</span>
      <div className="preview-thread">
        <div className="bubble incoming">Are you mad I left for work?</div>
        <div className="bubble outgoing">
          Mad? No. I am conducting a hallway security patrol and missing your
          thumbs professionally.
        </div>
        <div className="bubble incoming">Did you steal my sock again?</div>
        <div className="bubble outgoing">
          I prefer “archived for emotional support.”
        </div>
      </div>
    </aside>
  );
}
