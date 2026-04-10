/*
-----------------------------------------------------------
Convierte la imagen de heighmap (PNG en escala de grises)
En esto Datos numéricos (Float32Array) que Rapier sí puede usar 
---------------------------------------------------------------
*/

import { useEffect, useState } from "react";

export function useHeightmap(src, scale = 100) {
  const [data, setData] = useState(null);

  useEffect(() => {
    const img = new Image();
    img.src = src;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = img.width;
      canvas.height = img.height;

      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, img.width, img.height).data;

      const heights = new Float32Array(img.width * img.height);

      for (let i = 0; i < heights.length; i++) {
        const stride = i * 4;
        const r = imageData[stride]; // grayscale
        heights[i] = (r / 255) * scale;
      }

      setData({
        heights,
        width: img.width,
        height: img.height,
      });
    };
  }, [src, scale]);

  return data;
}