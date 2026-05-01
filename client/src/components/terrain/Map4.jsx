// client/src/components/terrain/Map4.jsx
import React from "react";
import GroundBase from "./GroundBase";

export const Map4 = ({ map, ...props }) => {

  return (
    <>
      <GroundBase map={map} {...props} />
    </>
  );
};

export default Map4;