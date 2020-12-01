import React from 'react';

interface Props {
  className?: string;
  value: string;
  style: React.CSSProperties;
}

export const BarGaugePercentValue: React.FC<Props> = ({ value, className, style }) => {
  return (
    <div className={className}>
      <div style={style}>
        <span>{value}</span>
      </div>
    </div>
  );
};
