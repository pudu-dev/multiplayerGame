

export default function CharacterHUD({ props }) {
    
    props = { health: 100, maxHealth: 100, energy: 100, maxEnergy: 100 };

    return (

        <div className="character-hud">

            <div className="health-bar">
                <div className="health-fill" style={{ width: `${(props.health / props.maxHealth) * 100}%` }}></div>
            </div>
            <div className="energy-bar">
                <div className="energy-fill" style={{ width: `${(props.energy / props.maxEnergy) * 100}%` }}></div>
            </div>
        </div>
    );

}