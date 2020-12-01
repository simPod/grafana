import React, { CSSProperties, FC } from 'react';

interface Props {
  className?: string;
  value: string;
  style: CSSProperties;
}

export const BarGaugePercentValue: FC<Props> = ({ value, className, style }) => {
  return (
    <div className={className}>
      <div style={style}>
        <span>{value}</span>
      </div>
    </div>
  );
};
