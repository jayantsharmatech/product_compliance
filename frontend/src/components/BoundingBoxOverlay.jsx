import React from 'react';

export default function BoundingBoxOverlay({ imageUrl, extractedFields }) {
  // Converts Gemini box_2d [ymin, xmin, ymax, xmax] (0-1000 scale) to percentage CSS coordinates
  const getBoxStyle = (box2d) => {
    if (!box2d || !Array.isArray(box2d) || box2d.length !== 4) return null;
    const [ymin, xmin, ymax, xmax] = box2d;
    return {
      top: `${(ymin / 1000) * 100}%`,
      left: `${(xmin / 1000) * 100}%`,
      height: `${((ymax - ymin) / 1000) * 100}%`,
      width: `${((xmax - xmin) / 1000) * 100}%`,
    };
  };

  return (
    <div className="relative inline-block w-full rounded-xl overflow-hidden border border-gray-200 bg-black/5 shadow-inner">
      <img
        src={imageUrl}
        alt="Packaging Scan"
        className="w-full h-auto block object-contain max-h-[500px]"
      />
      {Object.entries(extractedFields || {}).map(([key, field]) => {
        if (!field?.box_2d || !field?.found) return null;
        const style = getBoxStyle(field.box_2d);
        if (!style) return null;

        const isViolation = field.is_compliant === false;

        return (
          <div
            key={key}
            style={style}
            className={`absolute border-2 rounded transition-all duration-150 group hover:z-30 ${
              isViolation
                ? 'border-red-500 bg-red-500/20 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                : 'border-emerald-500 bg-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
            }`}
          >
            {/* Tooltip Label on Hover */}
            <div className="absolute -top-7 left-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[11px] font-semibold px-2 py-0.5 rounded shadow-lg whitespace-nowrap pointer-events-none z-40">
              <span className={isViolation ? 'text-red-400' : 'text-emerald-400'}>
                {key.replace(/_/g, ' ').toUpperCase()}
              </span>
              : {field.value || field.raw_text || 'Detected'}
            </div>
          </div>
        );
      })}
    </div>
  );
}