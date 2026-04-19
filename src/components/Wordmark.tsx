// ABOUT: The Takt wordmark — "takt" with an accent-coloured bar.
// ABOUT: Sized by font-size on the outer span; bar scales visually from that.

type Props = {
  size?: number;
};

export function Wordmark({ size = 17 }: Props) {
  return (
    <span className="wordmark" style={{ fontSize: size }} aria-label="Takt">
      takt
      <span className="bar" aria-hidden="true" />
    </span>
  );
}
