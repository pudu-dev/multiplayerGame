// Crosshair.jsx
export default function Crosshair({ size = 24 }) {
  const style = {
    position: "fixed",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    width: `${size}px`,
    height: `${size}px`,
    pointerEvents: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  };
  const lineStyle = {
    position: "absolute",
    background: "white",
  };
  return (
    <div style={style}>
      <div style={{ ...lineStyle, width: 2, height: size / 2, transform: `translateY(-${size/4}px)` }} />
      <div style={{ ...lineStyle, height: 2, width: size / 2, transform: `translateX(-${size/4}px)` }} />
    </div>
  );
}
