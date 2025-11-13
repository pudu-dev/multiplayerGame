// Crosshair.jsx
export default function Crosshair({ size = 24, color = "white" }) {
  const half = size / 2;

  return (
    <div
      className="fixed left-1/2 top-1/2 pointer-events-none z-100"
      style={{ transform: "translate(-50%, -50%)" }}
    >
      {/* Línea superior */}
      <div
        className="absolute left-1/2 bg-white"
        style={{
          width: "2px",
          height: `${half}px`,
          top: `-${size}px`,
          transform: "translateX(-50%)",
          backgroundColor: color,
        }}
      />

      {/* Línea inferior */}
      <div
        className="absolute left-1/2 bg-white"
        style={{
          width: "2px",
          height: `${half}px`,
          bottom: `-${size}px`,
          transform: "translateX(-50%)",
          backgroundColor: color,
        }}
      />

      {/* Línea izquierda */}
      <div
        className="absolute top-1/2 bg-white"
        style={{
          height: "2px",
          width: `${half}px`,
          left: `-${size}px`,
          transform: "translateY(-50%)",
          backgroundColor: color,
        }}
      />

      {/* Línea derecha */}
      <div
        className="absolute top-1/2 bg-white"
        style={{
          height: "2px",
          width: `${half}px`,
          right: `-${size}px`,
          transform: "translateY(-50%)",
          backgroundColor: color,
        }}
      />
    </div>
  );
}
