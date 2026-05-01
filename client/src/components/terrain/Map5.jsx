// client/src/components/terrain/Map5.jsx
import React from "react";
import GroundBase from "./GroundBase";


export const Map5 = ({ map, ...props }) => {
  return (
    <>
      <GroundBase map={map} {...props} />
    </>
  );
};

export default Map5;