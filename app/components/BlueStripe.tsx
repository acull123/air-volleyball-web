export default function BlueStripe() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        background:
          "linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(37,99,235,0.0) 28%)",
        maskImage:
          "linear-gradient(135deg, transparent 0%, black 8%, black 12%, transparent 20%)",
        WebkitMaskImage:
          "linear-gradient(135deg, transparent 0%, black 8%, black 12%, transparent 20%)",
      }}
    />
  );
}
