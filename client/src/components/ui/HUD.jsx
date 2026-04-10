import "./HUD.css";

export default function HUD({ health = 100, stamina = 100 }) {
  return (
    <div className="contenedor-hud-principal">

      <h2 className="title">Mini HUD</h2>
      
      <p className="parrafo">
        MLB para mover <br/> 
        SPACE para saltar
      </p>


      {/* Barra de vida */}
      <div className="barra-vida-contenedor">

        <span className="barra-vida-parrafo">Health</span>

        <div className="barra-vida">

          <div className="barra-vida-actual" style={{ width: `${health}%` }} />

        </div>

      </div>



      {/* Barra de energía / stamina */}
      <div className="barra-energia-contenedor">

        <span className="barra-energia-parrafo">Stamina</span>

        <div className="barra-energia">

          <div className="barra-energia-actual" style={{ width: `${stamina}%` }} />

        </div>

      </div>



    </div>
  );
}
