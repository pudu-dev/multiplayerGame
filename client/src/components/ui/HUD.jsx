import "./HUD.css";

export default function HUD({ health = 100, stamina = 100, cooldowns = {} }) {
  return (

    <div className="hud-container">

      <div className="hud-marco">
        {/* VIDA + STAMINA */}
        <div className="bars">
          <div className="bar health">
            <div style={{ width: `${health}%` }} />
          </div>

          <div className="bar stamina">
            <div style={{ width: `${stamina}%` }} />
          </div>
        </div>

        {/* HABILIDADES */}
        <div className="abilities">

          {[1, 2, 3, 4].map((id) => {
            const cd = cooldowns[id] || 0;
            const seconds = (cd / 1000).toFixed(1);

            return (
              <div key={id} className="ability">

                <span className="key">{id}</span>

                {cd > 0 && (
                  <div className="cooldown">
                    {seconds}
                  </div>
                )}

              </div>
            );
          })}

        </div>

      </div>

    </div>
  );
}